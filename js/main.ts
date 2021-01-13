const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 720;
const N = 5;

const TEAM_A_NAME_INPUT = document.getElementById('teamA-name') as HTMLInputElement;
const TEAM_B_NAME_INPUT = document.getElementById('teamB-name') as HTMLInputElement;
const GUIDE_MESSAGE_ELEM = document.getElementById('guide-message') as HTMLDivElement;
const CANVAS_WRAPPER_ELEM = document.getElementById('canvas-wrapper') as HTMLElement;


function newDim2Array<T>(row: number, col: number, fillValue: T): T[][] {
    let ret = new Array<Array<T>>(row);
    for (let i = 0; i < row; ++i) {
        ret[i] = new Array<T>(col).fill(fillValue);
    }
    return ret;
}


function zeroPadding(value: number, digitLength: number): string {
    return (Array(digitLength).join('0') + value).slice(-digitLength);
}


function drawUnderlinedText(ctx: CanvasRenderingContext2D,
                            text: string,
                            centerX: number,
                            topY: number,
                            fontSize: number,
                            underlineColor: string
): void {
    ctx.save();

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = fontSize + "px sans-serif";
    ctx.fillStyle = "#333";
    const textRect = Geometry.textRectBounding(ctx, text);
    ctx.fillText(text, centerX, topY);

    const underlineY = topY + textRect.h + 8;
    ctx.strokeStyle = underlineColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(centerX - textRect.w * 0.55, underlineY);
    ctx.lineTo(centerX + textRect.w * 0.55, underlineY);

    ctx.stroke();
}


function createBlumaButton(innerText: string, bgColor: string, fgColor: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.classList.add("button", "is-rounded");
    btn.style.position = 'absolute';
    btn.innerText = innerText;
    btn.style.backgroundColor = bgColor;
    btn.style.color = fgColor;
    return btn;
}


abstract class Geometry {
    static centerPos(elementLength: number, containerLength: number): number {
        return (containerLength - elementLength) / 2;
    }

    static textRectBounding(ctx: CanvasRenderingContext2D, text: string): { w: number, h: number } {
        const rect = ctx.measureText(text);
        return {
            w: rect.width,
            h: rect.actualBoundingBoxAscent + rect.actualBoundingBoxDescent
        };
    }
}


abstract class Easing {
    static easeOutCubic(x: number): number {
        const t = 1 - x;
        return 1 - t * t * t;
    }
}


abstract class MyColor {
    static readonly whiteGray = '#eee';
    static readonly lightGray = '#999';
    static readonly darkGray = '#333';
    static readonly teamA_red = '#CB2400';
    static readonly teamB_blue = '#236CCA'
    static readonly clickableGreen = '#c3ffc3';
    static readonly selectedClickableGreen = '#78ff5f';
    static readonly moveActorCyan = '#afeeff';
}


interface MyAnimation {
    update: (timestamp: number) => void;
    hasAnimFinished: () => boolean;
    onAnimFinish: () => void;
}


class TimeRatioAnimation implements MyAnimation {
    readonly lengthTime: number;
    readonly delay: number;
    readonly task: (ratio: number) => boolean; // アニメーションを続けるなら true, 続けないなら false
    readonly onAnimFinish: () => void;

    private _timestampAtRegistered = -1;
    private _timestampAtAnimStarted = -1;
    private _hasAnimFinished = false;

    // 時間の単位は全てミリ秒
    constructor(lengthTime: number, delay: number, task: (ratio: number) => boolean, onAnimFinish: () => void) {
        this.lengthTime = lengthTime;
        this.delay = delay;
        this.task = task;
        this.onAnimFinish = onAnimFinish;
    }

    hasAnimFinished(): boolean {
        return this._hasAnimFinished;
    }

    start(): void {
        AnimationExecutor.registerAnimation(this);
    }

    update(timestamp: number): void {

        if (this.hasAnimFinished()) {
            return;
        }

        if (this._timestampAtRegistered == -1) {
            this._timestampAtRegistered = timestamp;
        }
        const elapsedTimeFromRegistered = timestamp - this._timestampAtRegistered;
        if (elapsedTimeFromRegistered < this.delay) {
            return;
        }

        if (this._timestampAtAnimStarted == -1) {
            this._timestampAtAnimStarted = timestamp;
        }
        const elapsedTimeFromAnimStarted = timestamp - this._timestampAtAnimStarted;
        if (elapsedTimeFromAnimStarted > this.lengthTime) {
            this._hasAnimFinished = true;
            return;
        }

        const ratio = elapsedTimeFromAnimStarted / this.lengthTime;
        const isContinue = this.task(ratio);
        this._hasAnimFinished ||= !isContinue;
    }
}


abstract class AnimationExecutor {
    private static _animationList: MyAnimation[] = [];

    static registerAnimation(anim: MyAnimation): void {
        anim.update = anim.update.bind(anim);
        anim.hasAnimFinished = anim.hasAnimFinished.bind(anim);
        this._animationList.push(anim);
    }

    static update(timestamp: number): void {
        let i = 0;

        while (i < this._animationList.length) {
            const anim = this._animationList[i];
            anim.update(timestamp);

            if (anim.hasAnimFinished()) {
                anim.onAnimFinish();
                this._animationList.splice(i, 1);
            } else {
                ++i;
            }
        }
    }
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
            AnimationExecutor.update(timestamp);
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


interface CellPos {
    row: number;
    col: number;
}


function isSameCellPos(p1: CellPos, p2: CellPos): boolean {
    return p1.row == p2.row && p1.col == p2.col;
}


class Cell implements CellPos {
    static readonly DEFAULT_FILL_COLOR = MyColor.whiteGray;
    static readonly DEFAULT_BORDER_COLOR = MyColor.lightGray;
    static readonly DEFAULT_BORDER_THICKNESS = 2;
    static readonly DEFAULT_MOUSE_HOVER_FILL_COLOR = '#ffffe9';
    static readonly DEFAULT_MOUSE_HOVER_BORDER_COLOR = '#292929';
    static readonly DEFAULT_MOUSE_CURSOR_STYLE = 'pointer;'

    isMouseHovering: boolean = false;
    fillColor: string;
    borderColor: string;
    borderThickness: number;
    mouseCursorStyle: string = Cell.DEFAULT_MOUSE_CURSOR_STYLE;

    mouseHoveredFillColor: string = Cell.DEFAULT_MOUSE_HOVER_FILL_COLOR;
    mouseHoveredBorderColor: string = Cell.DEFAULT_MOUSE_HOVER_BORDER_COLOR;

    constructor(public readonly row: number, public readonly col: number) {
        this.becomeDefaultAppearance();
    }

    becomeDefaultAppearance(): void {
        this.fillColor = Cell.DEFAULT_FILL_COLOR;
        this.borderColor = Cell.DEFAULT_BORDER_COLOR;
        this.borderThickness = Cell.DEFAULT_BORDER_THICKNESS;
        this.mouseHoveredFillColor = Cell.DEFAULT_MOUSE_HOVER_FILL_COLOR;
        this.mouseHoveredBorderColor = Cell.DEFAULT_MOUSE_HOVER_BORDER_COLOR;
        this.mouseCursorStyle = Cell.DEFAULT_MOUSE_CURSOR_STYLE;
    }

    getCurrentBorderColor(): string {
        return this.isMouseHovering ? this.mouseHoveredBorderColor : this.borderColor;
    }

    draw(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
        if (this.isMouseHovering) {
            ctx.fillStyle = this.mouseHoveredFillColor;
            ctx.strokeStyle = this.mouseHoveredBorderColor;
        } else {
            ctx.fillStyle = this.fillColor;
            ctx.strokeStyle = this.borderColor;
        }
        ctx.lineWidth = this.borderThickness;
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
    }
}


interface CellEventHandler {
    // クリックされたとき、セルにマウスが入ったとき、セルからマウスが出たときに呼び出されるコールバック関数
    onMouseClickCell: (c: Cell) => void;
    onMouseEnterCell: (c: Cell) => void;
    onMouseLeaveCell: (c: Cell) => void;
}


class CellEventDispatcher {
    private readonly gridView: GridView;
    private canvasMouseClickHandler: EventHandlerNonNull;
    private canvasMouseMoveHandler: EventHandlerNonNull;
    private readonly onMouseClickCell: (c: Cell) => void;
    private readonly onMouseEnterCell: (c: Cell) => void;
    private readonly onMouseLeaveCell: (c: Cell) => void;

    constructor(gridView: GridView, cellEventHandler: CellEventHandler) {
        this.gridView = gridView;
        this.onMouseClickCell = cellEventHandler.onMouseClickCell.bind(cellEventHandler);
        this.onMouseEnterCell = cellEventHandler.onMouseEnterCell.bind(cellEventHandler);
        this.onMouseLeaveCell = cellEventHandler.onMouseLeaveCell.bind(cellEventHandler);
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

    getCellAt(pos: CellPos): Cell {
        return this.cells.find(c => c.row == pos.row && c.col == pos.col);
    }

    draw(ctx: CanvasRenderingContext2D): void {
        this._drawCells(ctx);
        this._drawHeaders(ctx);
    }

    private _drawCells(ctx: CanvasRenderingContext2D): void {
        const borderHighlightedCells: Cell[] = [];

        for (let cell of this.cells) {
            if (cell.getCurrentBorderColor() != Cell.DEFAULT_BORDER_COLOR) {
                borderHighlightedCells.push(cell);
                continue;
            }
            const pos = this.getCellPosition(cell.row, cell.col);
            cell.draw(ctx, pos.x, pos.y, this.cellWidth, this.cellHeight);
        }

        for (let cell of borderHighlightedCells) {
            const pos = this.getCellPosition(cell.row, cell.col);
            cell.draw(ctx, pos.x, pos.y, this.cellWidth, this.cellHeight);
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

function teamColor(teamID: TeamID): string {
    if (teamID == TeamID.TEAM_A) return MyColor.teamA_red;
    if (teamID == TeamID.TEAM_B) return MyColor.teamB_blue;
    return 'black';
}

// teamA, teamB 両方の潜水艦を管理する
class SubmarineManager {
    showHPEnabled: boolean;
    private readonly gridView: GridView;
    private readonly teamASubmarines: Submarine[];
    private readonly teamBSubmarines: Submarine[];
    private readonly teamASubmarineImage: HTMLImageElement;
    private readonly teamBSubmarineImage: HTMLImageElement;
    private submarineImageHeight: number;
    private submarineImageWidth: number;

    constructor(gridView: GridView, showHPEnabled: boolean) {
        this.gridView = gridView;
        this.showHPEnabled = showHPEnabled;
        this.teamASubmarines = new Array<Submarine>();
        this.teamBSubmarines = new Array<Submarine>();

        this.teamASubmarineImage = new Image();
        this.teamBSubmarineImage = new Image();
        this.teamASubmarineImage.src = "assets/submarine-red.png"
        this.teamBSubmarineImage.src = "assets/submarine-blue.png"
    }

    // 新しく潜水艦を追加する。

    static calcSubmarineDrawnPosConstrainedToCell(
        pos: CellPos,
        teamID: TeamID,
        gridView: GridView,
        submarineWidth: number,
        submarineHeight: number,
        isOpponentAtSameCell: boolean
    ): { x: number, y: number } {
        const cellPos = gridView.getCellPosition(pos.row, pos.col);

        if (isOpponentAtSameCell) {
            const cx = Geometry.centerPos(submarineWidth, gridView.cellWidth) + cellPos.x;
            const cy = Geometry.centerPos(submarineHeight, gridView.cellHeight) + cellPos.y;
            const dx = gridView.cellWidth * 0.14;
            const dy = gridView.cellHeight * 0.22;
            const offsetY = gridView.cellHeight * 0.07;

            if (teamID == TeamID.TEAM_A) {
                return {x: cx - dx, y: cy + dy + offsetY};
            } else {
                return {x: cx + dx, y: cy - dy + offsetY};
            }
        } else {
            const x = Geometry.centerPos(submarineWidth, gridView.cellWidth) + cellPos.x;
            const y = Geometry.centerPos(submarineHeight, gridView.cellHeight) + cellPos.y;
            return {x: x, y: y};
        }
    }

    // 指定マスに既に潜水艦が存在しても追加する。
    newSubmarineAt(pos: CellPos, teamID: TeamID): void {
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

    addSubmarines(submarinesPoses: CellPos[], teamID: TeamID): void {
        for (const pos of submarinesPoses) {
            this.newSubmarineAt(pos, teamID);
        }
    }

    decrementHPAndAutoDeleteAt(pos: CellPos, teamID: TeamID): void {
        const submarine = this.getSubmarineAt(pos, teamID);
        if (submarine == null) return;
        submarine.hp -= 1;
        if (submarine.hp <= 0) {
            this.deleteSubmarineAt(pos, teamID);
        }
    }

    moveFromTo(from: CellPos, to: CellPos, teamID: TeamID, animTimeLength: number, onAnimFinish: () => void): void {
        const actor = this.getSubmarineAt(from, teamID);
        if (actor == null) return;
        actor.row = to.row;
        actor.col = to.col;

        const opponent = opponentTeamID(teamID);

        const moveInfos = [] as { submarine: Submarine, fromX: number, fromY: number, toX: number, toY: number }[];

        const gridView = this.gridView;
        const submarineWidth = this.submarineImageWidth;
        const submarineHeight = this.submarineImageHeight;

        function pushMoveInfo(submarine: Submarine, to: CellPos, teamID: TeamID, isOpponentAtSameCell: boolean): void {
            const fromX = submarine.x;
            const fromY = submarine.y;
            const {x: toX, y: toY} = SubmarineManager.calcSubmarineDrawnPosConstrainedToCell(
                to, teamID, gridView,
                submarineWidth, submarineHeight,
                isOpponentAtSameCell);
            moveInfos.push({submarine: submarine, fromX: fromX, fromY: fromY, toX: toX, toY: toY});
            submarine.isConstrainedToCell = false;
        }

        if (this.isExistsAt(from, opponent)) {
            const submarine = this.getSubmarineAt(from, opponent);
            pushMoveInfo(submarine, submarine, opponent, isSameCellPos(submarine, actor));
        }
        if (this.isExistsAt(to, opponent)) {
            const submarine = this.getSubmarineAt(to, opponent);
            pushMoveInfo(submarine, submarine, opponent, isSameCellPos(submarine, actor));
        }

        pushMoveInfo(actor, to, teamID, this.isExistsAt(to, opponent));

        function animTask(ratio: number): boolean {
            const k = Easing.easeOutCubic(ratio);

            for (const moveInfo of moveInfos) {
                const x = moveInfo.fromX + (moveInfo.toX - moveInfo.fromX) * k;
                const y = moveInfo.fromY + (moveInfo.toY - moveInfo.fromY) * k;
                moveInfo.submarine.x = x;
                moveInfo.submarine.y = y;
            }
            return true;
        }

        function onAnimFinishWrap(): void {
            for (const moveInfo of moveInfos) {
                moveInfo.submarine.isConstrainedToCell = true;
            }
            onAnimFinish()
        }

        new TimeRatioAnimation(animTimeLength, 100, animTask, onAnimFinishWrap)
            .start();
    }

    isTeamAWinner(): boolean {
        return this.teamASubmarines.length > 0 && this.teamBSubmarines.length <= 0;
    }

    isTeamBWinner(): boolean {
        return this.teamBSubmarines.length > 0 && this.teamASubmarines.length <= 0;
    }

    update(): void {
        this.submarineImageWidth = this.gridView.cellWidth * 0.60;
        this.submarineImageHeight = this.gridView.cellHeight * 0.25;

        for (const teamID of [TeamID.TEAM_A, TeamID.TEAM_B]) {
            const submarineArray = this.getSubmarineArrayOfTeam(teamID);
            for (let submarine of submarineArray) {
                if (!submarine.isConstrainedToCell) {
                    continue;
                }

                const drawnPos = SubmarineManager.calcSubmarineDrawnPosConstrainedToCell(
                    submarine, teamID,
                    this.gridView,
                    this.submarineImageWidth, this.submarineImageHeight,
                    this.isExistsAt(submarine, opponentTeamID(teamID)));

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

                if (!this.showHPEnabled) continue;

                ctx.fillStyle = teamColor(teamID);
                ctx.font = Math.floor(this.gridView.cellWidth * 0.14) + "px sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "bottom";
                const hpText = "♥".repeat(submarine.hp) + "♡".repeat(3 - submarine.hp);
                ctx.fillText(hpText,
                    submarine.x + this.submarineImageWidth / 2,
                    submarine.y);
            }
        }
        ctx.restore();
    }

    getSubmarineImage(teamID: TeamID): HTMLImageElement {
        return (teamID == TeamID.TEAM_A ? this.teamASubmarineImage : this.teamBSubmarineImage);
    }

    getSubmarineArrayOfTeam(teamID: TeamID): Submarine[] {
        if (teamID == TeamID.TEAM_A) return this.teamASubmarines;
        if (teamID == TeamID.TEAM_B) return this.teamBSubmarines;
        return undefined;
    }

    isExistsAt(pos: CellPos, teamID: TeamID): boolean {
        return this.indexOfSubmarineAt(pos, teamID) >= 0;
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
            // let nextScene = new InitialPositionInputScene(this.sceneManager);
            let nextScene = new BattleScene(
                this.sceneManager,
                [
                    {col: 0, row: 0},
                    {col: 0, row: 4},
                    {col: 4, row: 0},
                    {col: 4, row: 4},
                ],
                [
                    {col: 0, row: 0},
                    {col: 1, row: 1},
                    {col: 3, row: 2},
                    {col: 3, row: 4},
                ],
                TeamID.TEAM_B
            );
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


class InitialPositionInputScene implements Scene, CellEventHandler {
    readonly sceneManager: SceneManager;
    readonly gridView: GridView;
    readonly cellEventDispatcher: CellEventDispatcher;
    readonly teamASubmarineManager: SubmarineManager;
    readonly teamBSubmarineManager: SubmarineManager;

    currentTeam: TeamID = TeamID.TEAM_A;
    readonly teamASubmarineExistenceGrid: boolean[][];
    readonly teamBSubmarineExistenceGrid: boolean[][];

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
        this.gridView.topY = Geometry.centerPos(this.gridView.gridHeight, canvas.height) + 40;

        this.teamASubmarineManager = new SubmarineManager(this.gridView, false);
        this.teamBSubmarineManager = new SubmarineManager(this.gridView, false);
        this.teamASubmarineExistenceGrid = newDim2Array(N, N, false);
        this.teamBSubmarineExistenceGrid = newDim2Array(N, N, false);

        this.cellEventDispatcher = new CellEventDispatcher(this.gridView, this);

        this.teamAShowButton = createBlumaButton('TeamAの配置へ', MyColor.teamA_red, 'white');
        this.teamBShowButton = createBlumaButton('TeamBの配置へ', MyColor.teamB_blue, 'white');
        this.battleButton = createBlumaButton('Start Battle', 'forestgreen', 'white');
        this.teamAShowButton.style.top = "10px";
        this.teamAShowButton.style.left = "10px";
        this.teamBShowButton.style.top = "60px";
        this.teamBShowButton.style.left = "10px";
        this.battleButton.style.bottom = "20px";
        this.battleButton.style.right = "20px";

        this.teamAShowButton.onclick = this._onTeamAShowButtonClicked.bind(this);
        this.teamBShowButton.onclick = this._onTeamBShowButtonClicked.bind(this);
        this.battleButton.onclick = this._onBattleButtonClicked.bind(this);
    }

    setup(): void {
        GUIDE_MESSAGE_ELEM.innerText = "初期配置を設定してください。\nセルをクリックして潜水艦の有無を切り替えられます。";
        this._mouseEventSetup();

        CANVAS_WRAPPER_ELEM.appendChild(this.teamAShowButton);
        CANVAS_WRAPPER_ELEM.appendChild(this.teamBShowButton);
        CANVAS_WRAPPER_ELEM.appendChild(this.battleButton);
    }

    tearDown(): void {
        GUIDE_MESSAGE_ELEM.innerText = "";
        this.cellEventDispatcher.unhookMeFrom(this.sceneManager.canvas);

        CANVAS_WRAPPER_ELEM.removeChild(this.teamAShowButton);
        CANVAS_WRAPPER_ELEM.removeChild(this.teamBShowButton);
        CANVAS_WRAPPER_ELEM.removeChild(this.battleButton);
    }

    update(timestamp: number): void {
        if (this.currentTeam == TeamID.TEAM_A) {
            this.teamASubmarineManager.update();
        } else {
            this.teamBSubmarineManager.update();
        }
    }

    draw(ctx: CanvasRenderingContext2D): void {
        InitialPositionInputScene._drawBack(ctx);
        this.gridView.draw(ctx);
        if (this.currentTeam == TeamID.TEAM_A) {
            this.teamASubmarineManager.draw(ctx);
        } else {
            this.teamBSubmarineManager.draw(ctx);
        }
        this._drawTitle(ctx);
    }

    onMouseClickCell(cell: Cell): void {
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

    onMouseEnterCell(cell: Cell): void {
    }

    onMouseLeaveCell(cell: Cell): void {
    }

    private static _drawBack(ctx: CanvasRenderingContext2D): void {
        ctx.fillStyle = MyColor.whiteGray;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    private _drawTitle(ctx: CanvasRenderingContext2D): void {
        let title: string;
        let underlineColor: string;

        if (this.currentTeam == TeamID.TEAM_A) {
            const teamName = TEAM_A_NAME_INPUT.value || "TeamA";
            title = teamName + " の初期配置";
            underlineColor = MyColor.teamA_red;
        } else {
            const teamName = TEAM_B_NAME_INPUT.value || "TeamB";
            title = teamName + " の初期配置";
            underlineColor = MyColor.teamB_blue;
        }

        drawUnderlinedText(ctx, title,
            this.sceneManager.canvas.width / 2,
            40,
            28,
            underlineColor);
    }

    private _mouseEventSetup(): void {
        this.cellEventDispatcher.hookMeInto(this.sceneManager.canvas);
    }

    private _onTeamAShowButtonClicked(): void {
        this.currentTeam = TeamID.TEAM_A;
    }

    private _onTeamBShowButtonClicked(): void {
        this.currentTeam = TeamID.TEAM_B;
    }

    private _onBattleButtonClicked(): void {
        try {
            this._validatePlacement();
        } catch (e) {
            GUIDE_MESSAGE_ELEM.style.color = 'red';
            GUIDE_MESSAGE_ELEM.innerText = e.message;
            return;
        }
        GUIDE_MESSAGE_ELEM.innerText = "";
        const nextScene = new BattleScene(this.sceneManager,
            this.teamASubmarineManager.getSubmarineArrayOfTeam(TeamID.TEAM_A),
            this.teamBSubmarineManager.getSubmarineArrayOfTeam(TeamID.TEAM_B),
            TeamID.TEAM_A);
        this.sceneManager.changeScene(nextScene);
    }

    private _validatePlacement(): void {
        if (this.teamASubmarineManager.getSubmarineArrayOfTeam(TeamID.TEAM_A).length != 4) {
            const teamName = TEAM_A_NAME_INPUT.value || "TeamA";
            throw new Error(teamName + " の配置が不正です。\nちょうど4個配置してください。");
        }
        if (this.teamBSubmarineManager.getSubmarineArrayOfTeam(TeamID.TEAM_B).length != 4) {
            const teamName = TEAM_B_NAME_INPUT.value || "TeamB";
            throw new Error(teamName + " の配置が不正です。\nちょうど4個配置してください。");
        }
    }
}


enum BattleSceneState {
    OP_TYPE_SELECT,
    ATTACK_DEST_SELECT,
    MOVE_ACTOR_SELECT,
    MOVE_DEST_SELECT,
    ANIMATING,
    BATTLE_FINISHED,
}


class BattleScene implements Scene, CellEventHandler {
    readonly sceneManager: SceneManager;
    readonly gridView: GridView;
    readonly submarineManager: SubmarineManager;
    readonly cellEventDispatcher: CellEventDispatcher;

    readonly attackButton: HTMLButtonElement;
    readonly moveButton: HTMLButtonElement;
    readonly goBackButton: HTMLButtonElement;
    readonly applyButton: HTMLButtonElement;

    currentTurnCount: number = 1;
    currentTurn: TeamID;
    currentState: BattleSceneState;

    attackDestPos: CellPos;
    attackableCellGrid: boolean[][];

    moveActor: CellPos;
    moveDest: CellPos;
    movableCellGrid: boolean[][];

    constructor(sceneManager: SceneManager,
                teamAInitialPlacement: CellPos[],
                teamBInitialPlacement: CellPos[],
                firstTurnTeam: TeamID
    ) {
        this.sceneManager = sceneManager;
        this.gridView = new GridView(N, N, 100, 100);
        this.submarineManager = new SubmarineManager(this.gridView, true);
        this.currentTurn = firstTurnTeam;
        this.cellEventDispatcher = new CellEventDispatcher(this.gridView, this);

        const canvas = this.sceneManager.canvas;
        this.gridView.leftX = Geometry.centerPos(this.gridView.gridWidth, canvas.width);
        this.gridView.topY = Geometry.centerPos(this.gridView.gridHeight, canvas.height) + 40;

        this.submarineManager.addSubmarines(teamAInitialPlacement, TeamID.TEAM_A);
        this.submarineManager.addSubmarines(teamBInitialPlacement, TeamID.TEAM_B);

        this.attackButton = createBlumaButton("Attack", 'darkOrange', 'white');
        this.moveButton = createBlumaButton("Move", 'darkOrange', 'white');
        this.goBackButton = createBlumaButton("◀ Back", 'dimGray', 'white');
        this.applyButton = createBlumaButton("Apply", 'forestgreen', 'white');

        {
            const margin = 20;
            const opButtonWidth = 120;
            const canvasWidth = this.sceneManager.canvas.width;

            this.attackButton.style.bottom = margin + "px";
            this.attackButton.style.left = (canvasWidth / 2 - opButtonWidth - 10) + "px";
            this.attackButton.style.width = opButtonWidth + "px";

            this.moveButton.style.bottom = margin + "px";
            this.moveButton.style.right = (canvasWidth / 2 - opButtonWidth - 10) + "px";
            this.moveButton.style.width = opButtonWidth + "px";

            this.goBackButton.style.top = margin + "px";
            this.goBackButton.style.left = margin + "px";
            this.applyButton.style.right = margin + "px";
            this.applyButton.style.bottom = margin + "px";

            this.goBackButton.onclick = this.onGoBackButtonClick.bind(this);
            this.attackButton.onclick = this.onAttackButtonClick.bind(this);
            this.moveButton.onclick = this.onMoveButtonClick.bind(this);
            this.applyButton.onclick = this.onApplyButtonClick.bind(this);
        }
    }

    static calcAttackableCellGrid(submarinePoses: CellPos[], nrow: number, ncol: number): boolean[][] {
        const attackableCellGrid = newDim2Array(nrow, ncol, false);

        // 各潜水艦の周囲1マスを true にしておく
        for (const pos of submarinePoses) {
            for (let row = pos.row - 1; row <= pos.row + 1; ++row) {
                for (let col = pos.col - 1; col <= pos.col + 1; ++col) {
                    if (row < 0 || row >= nrow || col < 0 || col >= ncol) continue;
                    attackableCellGrid[row][col] = true;
                }
            }
        }

        // 自軍の潜水艦のマスには攻撃できないので除く
        for (const pos of submarinePoses) {
            attackableCellGrid[pos.row][pos.col] = false;
        }
        return attackableCellGrid;
    }

    static calcMovableCellGrid(fromPos: CellPos, nrow: number, ncol: number, fellowSubmarinePoses: CellPos[]): boolean[][] {
        const movableCellGrid = newDim2Array(nrow, ncol, false);
        const directions = [0, 1, 0, -1];

        for (let i = 0; i < directions.length; ++i) {
            for (const k of [1, 2]) {
                const dy = directions[i] * k;
                const dx = directions[i ^ 1] * k; // i xor 1
                const row = fromPos.row + dy;
                const col = fromPos.col + dx;
                if (row < 0 || row >= nrow || col < 0 || col >= ncol) continue;
                movableCellGrid[row][col] = true;
            }
        }

        for (const pos of fellowSubmarinePoses) {
            movableCellGrid[pos.row][pos.col] = false;
        }

        return movableCellGrid;
    }

    setup(): void {
        this.cellEventDispatcher.hookMeInto(this.sceneManager.canvas);
        CANVAS_WRAPPER_ELEM.appendChild(this.attackButton);
        CANVAS_WRAPPER_ELEM.appendChild(this.moveButton);
        CANVAS_WRAPPER_ELEM.appendChild(this.goBackButton);
        CANVAS_WRAPPER_ELEM.appendChild(this.applyButton);
        this.enterOpTypeSelectState();
    }

    tearDown(): void {
        this.cellEventDispatcher.unhookMeFrom(this.sceneManager.canvas);
        CANVAS_WRAPPER_ELEM.removeChild(this.attackButton);
        CANVAS_WRAPPER_ELEM.removeChild(this.moveButton);
        CANVAS_WRAPPER_ELEM.removeChild(this.goBackButton);
        CANVAS_WRAPPER_ELEM.removeChild(this.applyButton);
    }

    update(timestamp: number): void {
        this.submarineManager.update();
    }

    draw(ctx: CanvasRenderingContext2D): void {
        BattleScene._drawBack(ctx);
        this.gridView.draw(ctx);
        this.submarineManager.draw(ctx);
        this._drawTitle(ctx);
    }

    incrementTurn(): void {
        this.currentTurnCount += 1;
        this.currentTurn = opponentTeamID(this.currentTurn);
    }

    onMouseClickCell(c: Cell): void {
        switch (this.currentState) {
            case BattleSceneState.OP_TYPE_SELECT:
                break;
            case BattleSceneState.ATTACK_DEST_SELECT:
                if (this.attackableCellGrid[c.row][c.col]) {
                    this.highlightAttackableCells();
                    this.attackDestPos = c;
                    c.borderThickness = 5;
                    c.borderColor = c.mouseHoveredBorderColor = 'darkOrange';
                    c.fillColor = MyColor.selectedClickableGreen;

                    this.applyButton.disabled = false;
                }
                break;
            case BattleSceneState.MOVE_ACTOR_SELECT:
                if (this.submarineManager.isExistsAt(c, this.currentTurn)) {
                    this.moveActor = c;
                    this.enterMoveDestSelectState();
                }
                break;
            case BattleSceneState.MOVE_DEST_SELECT:
                if (this.movableCellGrid[c.row][c.col]) {
                    this.highlightMoveDestCandidateCells();
                    this.moveDest = c;
                    c.borderThickness = 5;
                    c.borderColor = c.mouseHoveredBorderColor = 'darkOrange';
                    c.fillColor = MyColor.selectedClickableGreen;

                    this.applyButton.disabled = false;
                } else if (this.submarineManager.isExistsAt(c, this.currentTurn)) {
                    this.moveActor = c;
                    this.enterMoveDestSelectState();
                }
                break;
        }
    }

    onMouseEnterCell(c: Cell): void {
    }

    onMouseLeaveCell(c: Cell): void {
    }

    onAttackButtonClick(): void {
        this.enterAttackDestSelectState();
    }

    onMoveButtonClick(): void {
        this.enterMoveActorSelectState();
    }

    onGoBackButtonClick(): void {
        this.enterOpTypeSelectState();
    }

    onApplyButtonClick(): void {
        switch (this.currentState) {
            case BattleSceneState.OP_TYPE_SELECT:
                break;
            case BattleSceneState.ATTACK_DEST_SELECT: {
                this.submarineManager.decrementHPAndAutoDeleteAt(this.attackDestPos, opponentTeamID(this.currentTurn));
                this.incrementTurn();
                if (this.submarineManager.isTeamAWinner() || this.submarineManager.isTeamBWinner()) {
                    this.enterBattleFinishedState();
                } else {
                    this.enterOpTypeSelectState();
                }
                break;
            }
            case BattleSceneState.MOVE_ACTOR_SELECT:
                break;
            case BattleSceneState.MOVE_DEST_SELECT: {
                const self = this;
                const onAnimFinish = () => {
                    self.incrementTurn();
                    self.enterOpTypeSelectState();
                }
                this.submarineManager.moveFromTo(this.moveActor, this.moveDest, this.currentTurn, 500, onAnimFinish);
                this.enterAnimatingState();
                // this.incrementTurn();
                // this.enterOpTypeSelectState();
                break;
            }
        }
    }

    enterOpTypeSelectState(): void {
        this.currentState = BattleSceneState.OP_TYPE_SELECT;
        this.setButtonDisplayStyle(false, true, true, false);
        this.resetCellsStyle();
        GUIDE_MESSAGE_ELEM.innerText = "攻撃または移動のどちらかのボタンを押してください。";
    }

    enterAttackDestSelectState(): void {
        this.currentState = BattleSceneState.ATTACK_DEST_SELECT;
        this.setButtonDisplayStyle(true, false, false, true);
        this.applyButton.disabled = true;
        this.highlightAttackableCells();
        GUIDE_MESSAGE_ELEM.innerText = "攻撃先のマスをクリックして Apply ボタンを押してください。";
    }

    enterMoveActorSelectState(): void {
        this.currentState = BattleSceneState.MOVE_ACTOR_SELECT;
        this.setButtonDisplayStyle(true, false, false, true);
        this.applyButton.disabled = true;
        this.highlightMoveActorCandidateCells();
        GUIDE_MESSAGE_ELEM.innerText = "移動する潜水艦をクリックしてください。";
    }

    enterMoveDestSelectState(): void {
        this.currentState = BattleSceneState.MOVE_DEST_SELECT;
        this.setButtonDisplayStyle(true, false, false, true);
        this.applyButton.disabled = true;
        this.highlightMoveDestCandidateCells();
        GUIDE_MESSAGE_ELEM.innerText = "移動先のマスをクリックして Apply ボタンを押してください。\n潜水艦をクリックすれば移動する潜水艦を変えることができます。";
    }

    enterAnimatingState(): void {
        this.currentState = BattleSceneState.ANIMATING;
        this.setButtonDisplayStyle(false, false, false, false);
        this.applyButton.disabled = true;
        this.resetCellsStyle();
        GUIDE_MESSAGE_ELEM.innerText = "";
    }

    enterBattleFinishedState(): void {
        this.currentState = BattleSceneState.BATTLE_FINISHED;
        this.setButtonDisplayStyle(false, false, false, false);
        this.applyButton.disabled = true;
        this.resetCellsStyle();

        let winnerTeamName: string;
        if (this.submarineManager.isTeamAWinner()) {
            winnerTeamName = (TEAM_A_NAME_INPUT.value || "TeamA");
        } else {
            winnerTeamName = (TEAM_B_NAME_INPUT.value || "TeamB");
        }
        GUIDE_MESSAGE_ELEM.innerText = "チーム " + winnerTeamName + " の皆さんおめでとうございます🎉🎉🎉";
    }

    setButtonDisplayStyle(goBackButtonEnabled: boolean, attackButtonEnabled: boolean, moveButtonEnabled: boolean, applyButtonEnabled: boolean): void {
        const bool2DisplayValue = (displayEnabled: boolean) => displayEnabled ? "initial" : "none";
        this.goBackButton.style.display = bool2DisplayValue(goBackButtonEnabled);
        this.attackButton.style.display = bool2DisplayValue(attackButtonEnabled);
        this.moveButton.style.display = bool2DisplayValue(moveButtonEnabled);
        this.applyButton.style.display = bool2DisplayValue(applyButtonEnabled);
    }

    resetCellsStyle(): void {
        for (const cell of this.gridView.cells) {
            cell.becomeDefaultAppearance();
        }
    }

    highlightAttackableCells(): void {
        this.resetCellsStyle();

        this.attackableCellGrid = BattleScene.calcAttackableCellGrid(
            this.submarineManager.getSubmarineArrayOfTeam(this.currentTurn),
            this.gridView.nrow,
            this.gridView.ncol);

        for (const cell of this.gridView.cells) {
            if (this.attackableCellGrid[cell.row][cell.col]) {
                cell.fillColor = MyColor.clickableGreen;
                cell.mouseHoveredFillColor = MyColor.selectedClickableGreen;
                cell.mouseCursorStyle = 'pointer';
            } else {
                cell.mouseCursorStyle = 'not-allowed';
                cell.mouseHoveredFillColor = 'pink';
            }
        }
    }

    highlightMoveActorCandidateCells(): void {
        // 一旦すべてクリック禁止にする
        this.resetCellsStyle();
        for (const cell of this.gridView.cells) {
            cell.mouseCursorStyle = 'not-allowed';
            cell.mouseHoveredFillColor = 'pink';
        }

        // 自軍のいるマスのみクリック可能にする
        for (const submarine of this.submarineManager.getSubmarineArrayOfTeam(this.currentTurn)) {
            const cell = this.gridView.getCellAt(submarine);
            cell.mouseCursorStyle = 'pointer';
            cell.fillColor = MyColor.clickableGreen;
            cell.mouseHoveredFillColor = MyColor.selectedClickableGreen;
        }
    }

    highlightMoveDestCandidateCells(): void {
        this.movableCellGrid = BattleScene.calcMovableCellGrid(
            this.moveActor,
            this.gridView.nrow,
            this.gridView.ncol,
            this.submarineManager.getSubmarineArrayOfTeam(this.currentTurn));

        this.resetCellsStyle();

        for (const cell of this.gridView.cells) {
            if (this.movableCellGrid[cell.row][cell.col]) {
                cell.fillColor = MyColor.clickableGreen;
                cell.mouseHoveredFillColor = MyColor.selectedClickableGreen;
                cell.mouseCursorStyle = 'pointer';
            } else {
                cell.mouseHoveredFillColor = 'pink';
                cell.mouseCursorStyle = 'not-allowed';
            }
        }

        // 移動先選択中でも自軍のマスをクリックすれば移動元を変更できる。そのことがわかるよう自軍のいるマスのスタイルを設定。
        for (const submarine of this.submarineManager.getSubmarineArrayOfTeam(this.currentTurn)) {
            const cell = this.gridView.getCellAt(submarine);
            cell.mouseHoveredFillColor = MyColor.moveActorCyan;
            cell.mouseCursorStyle = 'pointer';
        }

        {
            const cell = this.gridView.getCellAt(this.moveActor);
            cell.fillColor = MyColor.moveActorCyan;
        }
    }

    private static _drawBack(ctx: CanvasRenderingContext2D): void {
        ctx.fillStyle = MyColor.whiteGray;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    private _drawTitle(ctx: CanvasRenderingContext2D): void {
        if (this.submarineManager.isTeamAWinner()) {
            drawUnderlinedText(ctx, "勝者: " + (TEAM_A_NAME_INPUT.value || "TeamA"),
                this.sceneManager.canvas.width / 2,
                40,
                28,
                MyColor.teamA_red);
            return;
        } else if (this.submarineManager.isTeamBWinner()) {
            drawUnderlinedText(ctx, "勝者: " + (TEAM_B_NAME_INPUT.value || "TeamB"),
                this.sceneManager.canvas.width / 2,
                40,
                28,
                MyColor.teamB_blue);
            return;
        }

        let teamName;
        let underlineColor: string;

        if (this.currentTurn == TeamID.TEAM_A) {
            teamName = TEAM_A_NAME_INPUT.value || "TeamA";
            underlineColor = MyColor.teamA_red;
        } else {
            teamName = TEAM_B_NAME_INPUT.value || "TeamB";
            underlineColor = MyColor.teamB_blue;
        }

        const title = "#" + zeroPadding(this.currentTurnCount, 2) + ":  " + teamName + " のターン";

        drawUnderlinedText(ctx, title,
            this.sceneManager.canvas.width / 2,
            40,
            28,
            underlineColor);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('main-canvas') as HTMLCanvasElement;
    const visualizer = new Visualizer(canvas);
    const titleScene = new TitleScene(visualizer);
    visualizer.run(titleScene);
});
