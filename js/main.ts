const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 720;
const N = 5;

const TEAM_A_NAME_INPUT = document.getElementById('teamA-name');
const TEAM_B_NAME_INPUT = document.getElementById('teamB-name');


function newDim2Array<T>(row: number, col: number, fillValue: T): T[][] {
    let ret = new Array<Array<T>>(row);
    for (let i = 0; i < row; ++i) {
        ret[i] = new Array<T>(col).fill(fillValue);
    }
    return ret;
}


abstract class Geometry {
    static centerPos(elementLength: number, containerLength: number): number {
        return (containerLength - elementLength) / 2;
    }

    static textRectBounding(ctx: CanvasRenderingContext2D, text: string): {w: number, h: number} {
        const rect = ctx.measureText(text);
        return {
            w: rect.width,
            h: rect.actualBoundingBoxAscent + rect.actualBoundingBoxDescent
        };
    }
}


abstract class MyColor {
    static readonly whiteGray = '#eee';
    static readonly lightGray = '#999';
    static readonly darkGray = '#333';
    static readonly teamA_red = '#CB2400';
    static readonly teamB_blue = '#236CCA'
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


class SceneCommonData {
    teamAGrid: number[][];
    teamBGrid: number[][];
}


interface CellPos {
    row: number;
    col: number;
}


class Cell implements CellPos {
    static readonly DEFAULT_FILL_COLOR = MyColor.whiteGray;
    static readonly DEFAULT_BORDER_COLOR = MyColor.lightGray;
    static readonly DEFAULT_BORDER_THICKNESS = 2;

    isMouseHovering: boolean = false;
    fillColor: string;
    borderColor: string;
    borderThickness: number;
    isBorderHighlighted: boolean = false;
    mouseCursorStyle: string = 'pointer';

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
    // クリックされたとき、セルにマウスが入ったとき、セルからマウスが出たときに呼び出されるコールバック関数
    onMouseClickCell: (c: Cell) => void;
    onMouseEnterCell: (c: Cell) => void;
    onMouseLeaveCell: (c: Cell) => void;

    private canvasMouseClickHandler: EventHandlerNonNull;
    private canvasMouseMoveHandler: EventHandlerNonNull;

    constructor(public gridView: GridView) {
    }

    hookMeInto(eventSource: HTMLElement): void {
        this.canvasMouseClickHandler = ((evt: MouseEvent) => {
            const rect = eventSource.getBoundingClientRect();
            const mouseX = evt.clientX - rect.left;
            const mouseY = evt.clientY - rect.top;
            for (let cell of this.gridView.cells) {
                if (this._doesCellContainsP(cell, mouseX, mouseY)) {
                    this.onMouseClickCell(cell);
                    return;
                }
            }
        });

        this.canvasMouseMoveHandler = ((evt: MouseEvent) => {
            const rect = eventSource.getBoundingClientRect();
            const mouseX = evt.clientX - rect.left;
            const mouseY = evt.clientY - rect.top;

            let mouseCursor = 'default';

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
                    mouseCursor = cell.mouseCursorStyle;
                }
            }

            eventSource.style.cursor = mouseCursor;
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
        this._drawHeaders(ctx);
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

    private _drawHeaders(ctx: CanvasRenderingContext2D): void {
        ctx.save();
        ctx.fillStyle = "#333";
        this._drawRowHeader(ctx);
        this._drawColHeader(ctx);
        ctx.restore();
    }

    private _drawRowHeader(ctx: CanvasRenderingContext2D): void {
        ctx.font = Math.floor(this.cellHeight * 0.3) + "px monospace";
        ctx.textAlign = "right";
        ctx.textBaseline = "top";

        const charCodeA = "A".charCodeAt(0);

        for (let row = 0; row < this.nrow; ++row) {
            const text = String.fromCharCode(charCodeA + row);
            const rect = Geometry.textRectBounding(ctx, text);
            const x = this.leftX - 15;
            const y = this.getCellPosition(row, 0).y + Geometry.centerPos(rect.h, this.cellHeight);
            ctx.fillText(text, x, y);
        }
    }

    private _drawColHeader(ctx: CanvasRenderingContext2D): void {
        ctx.font = Math.floor(this.cellWidth * 0.3) + "px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";

        const charCode1 = "1".charCodeAt(0);

        for (let col = 0; col < this.ncol; ++col) {
            const text = String.fromCharCode(charCode1 + col);
            const rect = Geometry.textRectBounding(ctx, text);
            const x = this.getCellPosition(0, col).x + (this.cellWidth / 2);
            const y = this.topY - 5;
            ctx.fillText(text, x, y);
        }

    }
}


class Submarine {
    y: number;
    x: number;
    visible: boolean = true;
    opacity: number = 1.0;
    isConstrainedToCell: boolean = true;

    constructor(public row: number, public col: number, public hp: number) {
    }
}


enum TeamID {
    TEAM_A,
    TEAM_B,
}


function opponentTeamID(teamID: TeamID): TeamID {
    return (1 - teamID) as TeamID;
}


// teamA, teamB 両方の潜水艦を管理する
class SubmarineManager {
    private readonly gridView: GridView;
    private readonly teamASubmarines: Submarine[];
    private readonly teamBSubmarines: Submarine[];

    private readonly teamASubmarineImage: HTMLImageElement;
    private readonly teamBSubmarineImage: HTMLImageElement;

    private submarineImageHeight: number;
    private submarineImageWidth: number;

    constructor(gridView: GridView) {
        this.gridView = gridView;
        this.teamASubmarines = new Array<Submarine>();
        this.teamBSubmarines = new Array<Submarine>();

        this.teamASubmarineImage = new Image();
        this.teamBSubmarineImage = new Image();
        this.teamASubmarineImage.src = "assets/submarine-red.png"
        this.teamBSubmarineImage.src = "assets/submarine-blue.png"
    }

    // 新しく潜水艦を追加する。
    // 指定マスに既に潜水艦が存在しても追加する。
    newSubmarineAt(pos: CellPos, teamID: TeamID): void {
        console.log("[newSubmarineAt] pos:", pos, "teamID:", teamID);
        const s = new Submarine(pos.row, pos.col, 3);
        this.getSubmarineArrayOfTeam(teamID).push(s);
    }

    // 削除対象の潜水艦が指定位置に無い場合は何もしない。
    deleteSubmarineAt(pos: CellPos, teamID: TeamID): void {
        const i = this.indexOfSubmarineAt(pos, teamID);
        if (i >= 0) {
            this.getSubmarineArrayOfTeam(teamID).splice(i, 1);
        }
    }

    decrementHPAt(pos: CellPos, teamID: TeamID): void {
        const submarine = this.getSubmarineAt(pos, teamID);
        if (submarine == null) return;
        submarine.hp -= 1;
    }


    moveFromTo(from: CellPos, to: CellPos, teamID: TeamID): void {
        const submarine = this.getSubmarineAt(from, teamID);
        if (submarine == null) return;
        submarine.row = to.row;
        submarine.col = to.col;
    }

    update(): void {
        this.submarineImageWidth = this.gridView.cellWidth * 0.60;
        this.submarineImageHeight = this.gridView.cellHeight * 0.25;

        for (const teamID of [TeamID.TEAM_A, TeamID.TEAM_B]) {
            const submarineArray = this.getSubmarineArrayOfTeam(teamID);
            for (let submarine of submarineArray) {
                const drawnPos = this.calcSubmarineDrawnPos(submarine, teamID);
                submarine.x = drawnPos.x;
                submarine.y = drawnPos.y;
            }
        }
    }

    draw(ctx: CanvasRenderingContext2D): void {
        ctx.save();
        for (const teamID of [TeamID.TEAM_A, TeamID.TEAM_B]) {
            const submarineArray = this.getSubmarineArrayOfTeam(teamID);
            for (let submarine of submarineArray) {
                const img = this.getSubmarineImage(teamID);
                ctx.globalAlpha = submarine.opacity;
                ctx.drawImage(img, submarine.x, submarine.y, this.submarineImageWidth, this.submarineImageHeight);
            }
        }
        ctx.restore();
    }

    getSubmarineImage(teamID: TeamID): HTMLImageElement {
        return (teamID == TeamID.TEAM_A ? this.teamASubmarineImage : this.teamBSubmarineImage);
    }

    calcSubmarineDrawnPos(submarine: Submarine, teamID: TeamID): { x: number, y: number } {
        if (!submarine.isConstrainedToCell) {
            return {x: submarine.x, y: submarine.y};
        }

        const isOpponentAtSameCell = this.getSubmarineAt(submarine, opponentTeamID(teamID)) != null;
        const w = this.submarineImageWidth;
        const h = this.submarineImageHeight;
        const cellPos = this.gridView.getCellPosition(submarine.row, submarine.col);

        if (isOpponentAtSameCell) {
            const cx = Geometry.centerPos(w, this.gridView.cellWidth) + cellPos.x;
            const cy = Geometry.centerPos(h, this.gridView.cellHeight) + cellPos.y;
            const dx = this.gridView.cellWidth * 0.15;
            const dy = this.gridView.cellHeight * 0.25;
            const offsetY = this.gridView.cellHeight * 0.07;

            if (teamID == TeamID.TEAM_A) {
                return {x: cx - dx, y: cy + dy + offsetY};
            } else {
                return {x: cx + dx, y: cy - dy + offsetY};
            }
        } else {
            const x = Geometry.centerPos(w, this.gridView.cellWidth) + cellPos.x;
            const y = Geometry.centerPos(h, this.gridView.cellHeight) + cellPos.y;
            return {x: x, y: y};
        }
    }

    getSubmarineArrayOfTeam(teamID: TeamID): Submarine[] {
        if (teamID == TeamID.TEAM_A) return this.teamASubmarines;
        if (teamID == TeamID.TEAM_B) return this.teamBSubmarines;
        return undefined;
    }

    private getSubmarineAt(pos: CellPos, teamID: TeamID): Submarine | null {
        const foundIndex = this.indexOfSubmarineAt(pos, teamID);
        return (foundIndex < 0 ? null : this.getSubmarineArrayOfTeam(teamID)[foundIndex]);
    }

    // 見つからなかったら負数を返す。
    private indexOfSubmarineAt(pos: CellPos, teamID: TeamID): number {
        const submarines = this.getSubmarineArrayOfTeam(teamID);
        for (let i = 0; i < submarines.length; ++i) {
            const submarine = submarines[i];
            if (submarine.row == pos.row && submarine.col == pos.col) {
                return i;
            }
        }
        return -1;
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
    readonly gridView: GridView;
    readonly cellEventDispatcher: CellEventDispatcher;
    readonly teamASubmarineManager: SubmarineManager;
    readonly teamBSubmarineManager: SubmarineManager;

    currentTeam: TeamID = TeamID.TEAM_A;
    readonly teamASubmarineExistenceGrid: boolean[][];
    readonly teamBSubmarineExistenceGrid: boolean[][];

    readonly canvasWrapper: HTMLElement;
    readonly teamAShowButton: HTMLButtonElement;
    readonly teamBShowButton: HTMLButtonElement;
    readonly battleButton: HTMLButtonElement;

    constructor(sceneManager: SceneManager) {
        this.sceneManager = sceneManager;
        const canvas = this.sceneManager.canvas;

        const cellWidth = 100;
        const cellHeight = 100;
        this.gridView = new GridView(N, N, cellWidth, cellHeight);

        this.gridView.leftX = Geometry.centerPos(this.gridView.gridWidth, canvas.width);
        this.gridView.topY = Geometry.centerPos(this.gridView.gridHeight, canvas.height);

        this.teamASubmarineManager = new SubmarineManager(this.gridView);
        this.teamBSubmarineManager = new SubmarineManager(this.gridView);
        this.teamASubmarineExistenceGrid = newDim2Array(N, N, false);
        this.teamBSubmarineExistenceGrid = newDim2Array(N, N, false);

        this.cellEventDispatcher = new CellEventDispatcher(this.gridView);

        this.canvasWrapper = document.getElementById('canvas-wrapper');

        function createButton(innerText: string, bgColor: string, fgColor: string): HTMLButtonElement {
            const btn = document.createElement('button');
            btn.classList.add("button", "is-rounded");
            btn.style.position = 'absolute';
            btn.innerText = innerText;
            btn.style.backgroundColor = bgColor;
            btn.style.color = fgColor;
            return btn;
        }

        this.teamAShowButton = createButton('TeamAの配置へ', MyColor.teamA_red, 'white');
        this.teamBShowButton = createButton('TeamBの配置へ', MyColor.teamB_blue, 'white');
        this.battleButton = createButton('Start Battle', 'forestgreen', 'white');
        this.teamAShowButton.style.top = "10px";
        this.teamAShowButton.style.left = "10px";
        this.teamBShowButton.style.top = "60px";
        this.teamBShowButton.style.left = "10px";
        this.battleButton.style.bottom = "10px";
        this.battleButton.style.right = "10px";

        this.teamAShowButton.onclick = this._onTeamAShowButtonClicked.bind(this);
        this.teamBShowButton.onclick = this._onTeamBShowButtonClicked.bind(this);
        this.battleButton.onclick = this._onBattleButtonClicked.bind(this);

        console.log(this.teamAShowButton.style);

    }

    setup(): void {
        this._mouseEventSetup();

        this.canvasWrapper.appendChild(this.teamAShowButton);
        this.canvasWrapper.appendChild(this.teamBShowButton);
        this.canvasWrapper.appendChild(this.battleButton);
    }

    tearDown(): void {
        this.cellEventDispatcher.unhookMeFrom(this.sceneManager.canvas);

        this.canvasWrapper.removeChild(this.teamAShowButton);
        this.canvasWrapper.removeChild(this.teamBShowButton);
        this.canvasWrapper.removeChild(this.battleButton);
    }

    update(timestamp: number): void {
        if (this.currentTeam == TeamID.TEAM_A) {
            this.teamASubmarineManager.update();
        } else {
            this.teamBSubmarineManager.update();
        }
    }

    draw(ctx: CanvasRenderingContext2D): void {
        this._drawBack(ctx);
        this.gridView.draw(ctx);
        if (this.currentTeam == TeamID.TEAM_A) {
            this.teamASubmarineManager.draw(ctx);
        } else {
            this.teamBSubmarineManager.draw(ctx);
        }
    }

    private _drawBack(ctx: CanvasRenderingContext2D): void {
        ctx.fillStyle = MyColor.whiteGray;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    private _mouseEventSetup(): void {
        this.cellEventDispatcher.onMouseClickCell = this._onMouseClick.bind(this);
        this.cellEventDispatcher.onMouseEnterCell = this._onMouseEnterCell.bind(this);
        this.cellEventDispatcher.onMouseLeaveCell = this._onMouseLeaveCell.bind(this);
        this.cellEventDispatcher.hookMeInto(this.sceneManager.canvas);
    }

    private _onMouseClick(cell: Cell): void {
        const row = cell.row;
        const col = cell.col;
        const existence = (this.currentTeam == TeamID.TEAM_A
            ? this.teamASubmarineExistenceGrid
            : this.teamBSubmarineExistenceGrid);
        const submarineManager = (this.currentTeam == TeamID.TEAM_A
            ? this.teamASubmarineManager
            : this.teamBSubmarineManager);

        if (existence[row][col]) {
            existence[row][col] = false;
            submarineManager.deleteSubmarineAt(cell, this.currentTeam);
        } else {
            existence[row][col] = true;
            submarineManager.newSubmarineAt(cell, this.currentTeam);
        }
    }

    private _onMouseEnterCell(cell: Cell): void {
        cell.fillColor = '#ffffe9'
        cell.highlightBorder('#292929');
    }

    private _onMouseLeaveCell(cell: Cell): void {
        cell.becomeDefaultAppearance();
    }

    private _onTeamAShowButtonClicked(): void {
        this.currentTeam = TeamID.TEAM_A;
    }

    private _onTeamBShowButtonClicked(): void {
        this.currentTeam = TeamID.TEAM_B;
    }

    private _onBattleButtonClicked(): void {

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
