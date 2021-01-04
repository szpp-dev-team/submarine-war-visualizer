const CANVAS_WIDTH = 860;
const CANVAS_HEIGHT = 640;
const N = 5;


abstract class Geometry {
    static centerPos(elementLength: number, containerLength: number): number {
        return (containerLength - elementLength) / 2;
    }
}


abstract class MyColor {
    static readonly whiteGray = '#eee';
    static readonly lightGray = '#999';
    static readonly darkGray = '#333';
    static readonly submarine_red = '#CB2400';
    static readonly submarine_blue = '#236CCA'
}

interface Scene {
    sceneManager: SceneManager;
    setup: () => void;
    tearDown: () => void;
    update: (timestamp: number) => void;
    draw: (ctx: CanvasRenderingContext2D) => void;
}


interface SceneManager {
    canvas: HTMLCanvasElement;
    changeScene: (nextScene: Scene) => void;
}


class Visualizer implements SceneManager {
    readonly canvas: HTMLCanvasElement;
    readonly ctx: CanvasRenderingContext2D;
    curScene: Scene;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.curScene = null;

        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;
        this.ctx.textAlign = 'center';
    }

    run(firstScene: Scene): void {
        this.curScene = firstScene;
        this.curScene.setup();
        const animationLoop = (timestamp: number): void => {
            this.curScene.update(timestamp);
            this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            this.curScene.draw(this.ctx);
            requestAnimationFrame(animationLoop);
        };
        requestAnimationFrame(animationLoop);
    }

    changeScene(nextScene: Scene): void {
        this.curScene.tearDown();
        this.curScene = nextScene;
        this.curScene.setup();
    }
}

class Cell {
    static readonly DEFAULT_FILL_COLOR = MyColor.whiteGray;
    static readonly DEFAULT_BORDER_COLOR = MyColor.lightGray;
    static readonly DEFAULT_BORDER_THICKNESS = 2;

    isMouseHovering: boolean = false;
    fillColor: string;
    borderColor: string;
    borderThickness: number;
    isBorderHighlighted: boolean = false;

    constructor(public readonly row: number, public readonly col: number) {
        this.becomeDefaultAppearance();
    }

    becomeDefaultAppearance(): void {
        this.fillColor = Cell.DEFAULT_FILL_COLOR;
        this.borderColor = Cell.DEFAULT_BORDER_COLOR;
        this.borderThickness = Cell.DEFAULT_BORDER_THICKNESS;
        this.isBorderHighlighted = false;
    }

    highlightBorder(color: string, thickness: number = Cell.DEFAULT_BORDER_THICKNESS): void {
        this.borderColor = color;
        this.borderThickness = thickness;
        this.isBorderHighlighted = true;
    }
}


class CellEventDispatcher {
    onMouseClickCell: (c: Cell) => void;
    onMouseEnterCell: (c: Cell) => void;
    onMouseLeaveCell: (c: Cell) => void;
    onMouseMoveCell: (c: Cell) => void;

    private canvasMouseClickHandler: EventHandlerNonNull;
    private canvasMouseMoveHandler: EventHandlerNonNull;

    constructor(public gridView: GridView) {
    }

    hookMeInto(eventSource: HTMLElement): void {
        this.canvasMouseClickHandler = ((evt: MouseEvent) => {
            const mouseX = evt.clientX - eventSource.offsetLeft;
            const mouseY = evt.clientY - eventSource.offsetTop;
            for (let cell of this.gridView.cells) {
                if (this._doesCellContainsP(cell, mouseX, mouseY)) {
                    this.onMouseClickCell(cell);
                    return;
                }
            }
        });

        this.canvasMouseMoveHandler = ((evt: MouseEvent) => {
            const mouseX = evt.clientX - eventSource.offsetLeft;
            const mouseY = evt.clientY - eventSource.offsetTop;

            for (let cell of this.gridView.cells) {
                const hovered = this._doesCellContainsP(cell, mouseX, mouseY);

                if (cell.isMouseHovering && !hovered) {
                    cell.isMouseHovering = false;
                    this.onMouseLeaveCell(cell);
                } else if (!cell.isMouseHovering && hovered) {
                    cell.isMouseHovering = true;
                    this.onMouseEnterCell(cell);
                }

                if (hovered) {
                    this.onMouseMoveCell(cell);
                }
            }
        });

        eventSource.addEventListener('click', this.canvasMouseClickHandler, false);
        eventSource.addEventListener('mousemove', this.canvasMouseMoveHandler, false);
    }

    unhookMeFrom(eventSource: HTMLElement): void {
        eventSource.removeEventListener('click', this.canvasMouseClickHandler, false);
        eventSource.removeEventListener('mousemove', this.canvasMouseMoveHandler, false);
    }

    private _doesCellContainsP(cell: Cell, pointX: number, pointY: number): boolean {
        const {x: leftX, y: topY} = this.gridView.getCellPosition(cell.row, cell.col);
        const rightX = leftX + this.gridView.cellWidth;
        const bottomY = topY + this.gridView.cellHeight;
        return (leftX < pointX && pointX < rightX && topY < pointY && pointY < bottomY);
    }
}


class GridView {
    readonly cells: Cell[] = [];
    leftX: number = 0;
    topY: number = 0;

    constructor(public readonly nrow: number,
                public readonly ncol: number,
                public cellWidth: number,
                public cellHeight: number
    ) {
        // row行 col列 のセルを生成して配列に格納する。
        for (let row = 0; row < this.nrow; ++row) {
            for (let col = 0; col < this.ncol; ++col) {
                this.cells.push(new Cell(row, col));
            }
        }
    }

    get gridWidth(): number {
        return this.cellWidth * this.ncol;
    }

    get gridHeight(): number {
        return this.cellHeight * this.nrow;
    }

    getCellPosition(row: number, col: number): { x: number, y: number } {
        const py = this.topY + this.cellHeight * row;
        const px = this.leftX + this.cellWidth * col;
        return {x: px, y: py};
    }

    draw(ctx: CanvasRenderingContext2D): void {
        this._drawCells(ctx);
    }

    private _drawCells(ctx: CanvasRenderingContext2D): void {
        const borderHighlightedCells: Cell[] = [];

        for (let cell of this.cells) {
            ctx.fillStyle = cell.fillColor;
            ctx.strokeStyle = cell.borderColor;
            ctx.lineWidth = cell.borderThickness;
            const pos = this.getCellPosition(cell.row, cell.col);
            ctx.fillRect(pos.x, pos.y, this.cellWidth, this.cellHeight);
            ctx.strokeRect(pos.x, pos.y, this.cellWidth, this.cellHeight);

            if (cell.isBorderHighlighted) {
                borderHighlightedCells.push(cell);
            }
        }

        for (let cell of borderHighlightedCells) {
            ctx.strokeStyle = cell.borderColor;
            ctx.lineWidth = cell.borderThickness;
            const pos = this.getCellPosition(cell.row, cell.col);
            ctx.strokeRect(pos.x, pos.y, this.cellWidth, this.cellHeight);
        }
    }
}


class TitleScene implements Scene {
    sceneManager: SceneManager;
    private readonly clickHandler: EventListener;

    constructor(sceneManager: SceneManager) {
        this.sceneManager = sceneManager;

        this.clickHandler = () => {
            console.log("[TitleScene#clickHandler] Clicked!");
            let nextScene = new InitialPositionInputScene(this.sceneManager);
            this.sceneManager.changeScene(nextScene);
        };

        this.sceneManager.canvas.addEventListener('click', this.clickHandler, false);
    }

    setup(): void {
    }

    tearDown(): void {
        this.sceneManager.canvas.removeEventListener('click', this.clickHandler, false);
    }

    update(timestamp: number): void {
    }

    draw(ctx: CanvasRenderingContext2D): void {
        this._drawBack(ctx);
        this._drawMessage(ctx);
    }

    private _drawMessage(ctx: CanvasRenderingContext2D): void {
        ctx.fillStyle = MyColor.darkGray;
        ctx.font = '32px sans-serif'
        const msg = "潜水艦の初期配置を入力してOKボタンを押してください";
        ctx.fillText(msg, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }

    private _drawBack(ctx: CanvasRenderingContext2D): void {
        ctx.fillStyle = MyColor.whiteGray;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
}


class InitialPositionInputScene implements Scene {
    sceneManager: SceneManager;
    gridView: GridView;
    cellEventDispatcher: CellEventDispatcher;

    constructor(sceneManager: SceneManager) {
        const cellWidth = 100;
        const cellHeight = 100;
        this.sceneManager = sceneManager;
        this.gridView = new GridView(N, N, cellWidth, cellHeight);
        const canvas = this.sceneManager.canvas;
        this.gridView.leftX = Geometry.centerPos(this.gridView.gridWidth, canvas.width);
        this.gridView.topY = Geometry.centerPos(this.gridView.gridHeight, canvas.height);

        this.cellEventDispatcher = new CellEventDispatcher(this.gridView);
    }

    setup(): void {
        this._mouseEventSetup();
    }

    tearDown(): void {
        this.cellEventDispatcher.unhookMeFrom(this.sceneManager.canvas);
    }

    update(timestamp: number): void {
    }

    draw(ctx: CanvasRenderingContext2D): void {
        this._drawBack(ctx);
        this.gridView.draw(ctx);
    }

    private _drawBack(ctx: CanvasRenderingContext2D): void {
        ctx.fillStyle = MyColor.whiteGray;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    private _mouseEventSetup(): void {
        const canvas = this.sceneManager.canvas;

        const onMouseClickCell = (cell: Cell) => {
            console.log("[Cell Clicked]", cell);
        };
        const onMouseEnterCell = (cell: Cell) => {
            cell.fillColor = '#ffffe9'
            cell.highlightBorder('#292929');
        }
        const onMouseLeaveCell = (cell: Cell) => {
            cell.becomeDefaultAppearance();
            canvas.style.cursor = 'default';
        }
        const onMouseMoveCell = (cell: Cell) => {
            canvas.style.cursor = 'pointer';
        }

        this.cellEventDispatcher.onMouseClickCell = onMouseClickCell;
        this.cellEventDispatcher.onMouseEnterCell = onMouseEnterCell;
        this.cellEventDispatcher.onMouseLeaveCell = onMouseLeaveCell;
        this.cellEventDispatcher.onMouseMoveCell = onMouseMoveCell;
        this.cellEventDispatcher.hookMeInto(this.sceneManager.canvas);
    }
}


class BattleScene implements Scene {
    sceneManager: SceneManager;

    constructor(sceneManager: SceneManager) {
    }

    setup(): void {
    }

    tearDown(): void {
    }

    update(timestamp: number): void {
    }

    draw(ctx: CanvasRenderingContext2D): void {
        this._draw_back(ctx);
        this._draw_message(ctx);
    }

    private _draw_message(ctx: CanvasRenderingContext2D): void {
        ctx.fillStyle = MyColor.darkGray;
        ctx.font = '32px sans-serif'
        const msg = "Battle Scene";
        ctx.fillText(msg, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }

    private _draw_back(ctx: CanvasRenderingContext2D): void {
        ctx.fillStyle = MyColor.whiteGray;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('main-canvas') as HTMLCanvasElement;
    const visualizer = new Visualizer(canvas);
    const titleScene = new TitleScene(visualizer);
    visualizer.run(titleScene);
});
