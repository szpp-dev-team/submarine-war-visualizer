const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 720;
const N = 5;

const TEAM_A_NAME_INPUT = document.getElementById('teamA-name') as HTMLInputElement;
const TEAM_B_NAME_INPUT = document.getElementById('teamB-name') as HTMLInputElement;
const GUIDE_MESSAGE_ELEM = document.getElementById('guide-message') as HTMLDivElement;
const CANVAS_WRAPPER_ELEM = document.getElementById('canvas-wrapper') as HTMLElement;


function setGuideMessage(message: string, color: string): void {
    GUIDE_MESSAGE_ELEM.style.color = color;
    GUIDE_MESSAGE_ELEM.innerText = message;
}


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


function hexToRgb(hex: string): number[] {
    if (hex.charAt(0) == '#') hex = hex.slice(1);
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;

    return [r, g, b];
}


function rgbToHex(r: number, g: number, b: number): string {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
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
    static easeInCubic(x: number): number {
        return x * x * x;
    }

    static easeOutCubic(x: number): number {
        const t = 1 - x;
        return 1 - t * t * t;
    }

    static easeOutSine(x: number): number {
        return Math.sin(x * Math.PI / 2);
    }

    static easeOutQuint(x: number): number {
        const t = 1 - x;
        return 1 - t * t * t * t * t;
    }

    static easeOutQuad(x: number): number {
        return 1 - (1 - x) * (1 - x);
    }
}


abstract class MyColor {
    static readonly backGround = '#f9f9f9';
    static readonly whiteGray = '#eee';
    static readonly lightGray = '#999';
    static readonly darkGray = '#333';
    static readonly teamA_red = '#CB2400';
    static readonly teamB_blue = '#236CCA'
    static readonly clickableGreen = '#c3ffc3';
    static readonly selectedClickableGreen = '#78ff5f';
    static readonly moveActorCyan = '#afeeff';
    static readonly teamA_background = '#fdf0f0';
    static readonly teamB_background = '#f1f6ff';
}


abstract class MyTransition {
    private _timestampAtRegistered = -1;
    private _timestampAtTransitionStarted = -1;

    protected constructor(
        readonly delay: number,
        readonly onAnimFinish: () => void) {
    }

    abstract hasAnimFinished(): boolean;

    abstract handle(elapsedTimeMilli: number): void;

    start(): void {
        TransitionExecutor.registerTransition(this);
    }

    hasDelayFinished(): boolean {
        return this._timestampAtTransitionStarted != -1;
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

        if (this._timestampAtTransitionStarted == -1) {
            this._timestampAtTransitionStarted = timestamp;
        }
        const elapsedTimeFromAnimStarted = timestamp - this._timestampAtTransitionStarted;
        this.handle(elapsedTimeFromAnimStarted);
    }
}


abstract class MyAnimation extends MyTransition {
    abstract draw(ctx: CanvasRenderingContext2D): void;

    start(animExecutor: AnimationExecutor = null) {
        if (animExecutor == null) {
            super.start();
        } else {
            animExecutor.registerAnimation(this);
        }
    }
}


class TimeRatioTransition extends MyTransition {
    readonly lengthTime: number;
    readonly task: (ratio: number) => boolean; // トランジションを続けるなら true, 続けないなら false

    private _hasAnimFinished = false;

    // 時間の単位は全てミリ秒
    constructor(lengthTime: number, delay: number, task: (ratio: number) => boolean, onAnimFinish: () => void) {
        super(delay, onAnimFinish);
        this.lengthTime = lengthTime;
        this.task = task;
    }

    hasAnimFinished(): boolean {
        return this._hasAnimFinished;
    }

    handle(elapsedTimeMilli: number) {
        if (elapsedTimeMilli > this.lengthTime) {
            this._hasAnimFinished = true;
            return;
        }
        // elapsedTime / lengthTime が 1.0 を超えないよう min をとっておく
        const ratio = Math.min(elapsedTimeMilli, this.lengthTime) / this.lengthTime;
        const isContinue = this.task(ratio);
        this._hasAnimFinished ||= !isContinue;
    }
}


class SpriteSheetAnimation extends MyAnimation {

    readonly frameWidth: number;
    readonly frameHeight: number;
    x: number;
    y: number;
    w: number;
    h: number;
    private _currentFrameIndex: number;

    constructor(
        public readonly spriteSheet: HTMLImageElement,
        public readonly nrow: number,
        public readonly ncol: number,
        public readonly duration: number,
        delay: number,
        onAnimFinished: () => void,
    ) {
        super(delay, onAnimFinished);
        this.frameHeight = (spriteSheet.height / nrow) | 0;
        this.frameWidth = (spriteSheet.width / ncol) | 0;
        this._currentFrameIndex = -1;
    }

    get allFrameCount(): number {
        return this.nrow * this.ncol;
    }

    hasAnimFinished(): boolean {
        return this._currentFrameIndex >= this.allFrameCount;
    }

    handle(elapsedTimeMilli: number) {
        this._currentFrameIndex = (elapsedTimeMilli / this.duration) | 0;
    }

    draw(ctx: CanvasRenderingContext2D): void {
        if (this.hasAnimFinished()) return;

        const row = (this._currentFrameIndex / this.ncol) | 0;
        const col = (this._currentFrameIndex % this.ncol);
        const sx = this.frameWidth * col;
        const sy = this.frameHeight * row;
        ctx.drawImage(this.spriteSheet, sx, sy, this.frameWidth, this.frameHeight, this.x, this.y, this.w, this.h);
    }
}


class FloatUpTextAnimation extends MyAnimation {
    private readonly x: number;
    private y: number;
    private opacity: number;
    private hasFinished: boolean = false;

    constructor(
        readonly text: string,
        readonly startX: number,
        readonly startY: number,
        readonly upDistance: number,
        readonly fillColor: string,
        readonly font: string,
        readonly timeLength: number,
        delay: number,
        onAnimFinish: () => void,
    ) {
        super(delay, onAnimFinish);
        this.x = startX;
        this.y = startY;
        this.opacity = 1.0;
    }

    handle(elapsedTimeMilli: number): void {
        if (elapsedTimeMilli > this.timeLength) {
            this.hasFinished = true;
            return;
        }
        const ratio = Math.min(this.timeLength, elapsedTimeMilli) / this.timeLength;
        this.y = this.startY - (this.upDistance * Easing.easeOutSine(ratio));
        this.opacity = 1.0 - Easing.easeInCubic(ratio);
    }

    hasAnimFinished(): boolean {
        return this.hasFinished;
    }

    draw(ctx: CanvasRenderingContext2D): void {
        if (this.hasAnimFinished()) return;

        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillStyle = this.fillColor;
        ctx.font = this.font;
        ctx.globalAlpha = this.opacity;
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}


class BlinkTransition extends MyTransition {
    private _hasAnimFinished: boolean;

    constructor(
        readonly obj: { visible: boolean },
        readonly timeLength: number,
        readonly duration: number,
        delay: number,
        onAnimFinish: () => void
    ) {
        super(delay, onAnimFinish);
        this._hasAnimFinished = false;
    }

    handle(elapsedTimeMilli: number): void {
        if (elapsedTimeMilli > this.timeLength) {
            this._hasAnimFinished = true;
            return;
        }
        const n = (elapsedTimeMilli / this.duration) | 0;
        this.obj.visible = !!(n & 1);
    }

    hasAnimFinished(): boolean {
        return this._hasAnimFinished;
    }
}


abstract class TransitionExecutor {
    private static readonly _transitionList: MyTransition[] = [];

    static registerTransition(trans: MyTransition): void {
        trans.update = trans.update.bind(trans);
        trans.hasAnimFinished = trans.hasAnimFinished.bind(trans);
        this._transitionList.push(trans);
    }

    static update(timestamp: number): void {
        let i = 0;

        while (i < this._transitionList.length) {
            const trans = this._transitionList[i];
            trans.update(timestamp);

            if (trans.hasAnimFinished()) {
                trans.onAnimFinish();
                this._transitionList.splice(i, 1);
            } else {
                ++i;
            }
        }
    }
}


class AnimationExecutor {
    private readonly _animList: MyAnimation[] = [];

    registerAnimation(anim: MyAnimation): void {
        anim.update = anim.update.bind(anim);
        anim.hasAnimFinished = anim.hasAnimFinished.bind(anim);
        this._animList.push(anim);
    }

    update(timestamp: number): void {
        let i = 0;

        while (i < this._animList.length) {
            const trans = this._animList[i];
            trans.update(timestamp);

            if (trans.hasAnimFinished()) {
                trans.onAnimFinish();
                this._animList.splice(i, 1);
            } else {
                ++i;
            }
        }
    }

    draw(ctx: CanvasRenderingContext2D): void {
        for (const anim of this._animList) {
            if (anim.hasDelayFinished() && !anim.hasAnimFinished()) {
                anim.draw(ctx);
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
            TransitionExecutor.update(timestamp);
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
    if (p1 == null || p2 == null) return false;
    return p1.row == p2.row && p1.col == p2.col;
}


class Cell implements CellPos {
    static readonly DEFAULT_FILL_COLOR = "#fcfcfc"
    static readonly DEFAULT_BORDER_COLOR = MyColor.lightGray;
    static readonly DEFAULT_BORDER_THICKNESS = 2;
    static readonly DEFAULT_MOUSE_HOVER_FILL_COLOR = '#ffffe9';
    static readonly DEFAULT_MOUSE_HOVER_BORDER_COLOR = '#292929';
    static readonly DEFAULT_MOUSE_CURSOR_STYLE = 'pointer';

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

    private readonly explosionSpriteSheet: HTMLImageElement;
    private explosionAnimation: SpriteSheetAnimation;

    constructor(gridView: GridView, showHPEnabled: boolean) {
        this.gridView = gridView;
        this.showHPEnabled = showHPEnabled;
        this.teamASubmarines = new Array<Submarine>();
        this.teamBSubmarines = new Array<Submarine>();

        this.teamASubmarineImage = new Image();
        this.teamBSubmarineImage = new Image();
        this.explosionSpriteSheet = new Image();
        this.teamASubmarineImage.src = "assets/submarine-red.png"
        this.teamBSubmarineImage.src = "assets/submarine-blue.png"
        this.explosionSpriteSheet.src = "assets/explosion.png";
    }

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

    decrementHPAndAutoDeleteAt(pos: CellPos, teamID: TeamID, onAnimFinish: () => void): void {
        const submarine = this.getSubmarineAt(pos, teamID);

        {
            const doNothing = function () {
            };

            this.explosionAnimation = new SpriteSheetAnimation(this.explosionSpriteSheet,
                5, 10, 20, 200, (submarine == null ? onAnimFinish : doNothing));

            const cellPos = this.gridView.getCellPosition(pos.row, pos.col);
            const w = this.gridView.cellWidth * 1.5;
            const h = this.gridView.cellHeight * 1.5;
            this.explosionAnimation.x = Geometry.centerPos(w, this.gridView.cellWidth) + cellPos.x;
            this.explosionAnimation.y = cellPos.y + this.gridView.cellHeight - h - this.gridView.cellHeight * 0.3;
            this.explosionAnimation.w = w;
            this.explosionAnimation.h = h;
            this.explosionAnimation.start();
        }

        if (submarine != null) {
            const self = this;

            function onAnimFinish_wrap(): void {
                submarine.visible = true;
                submarine.hp -= 1;
                if (submarine.hp <= 0) {
                    new TimeRatioTransition(1000, 100,
                        (ratio: number): boolean => {
                            submarine.opacity = 1.0 - ratio;
                            return true;
                        },
                        () => {
                            self.deleteSubmarineAt(pos, teamID);
                            setTimeout(onAnimFinish, 500);
                        }).start();
                } else {
                    setTimeout(onAnimFinish, 500);
                }
            }

            submarine.opacity = 1.0;
            new BlinkTransition(submarine, 1200, 100, 200, onAnimFinish_wrap).start();
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

        this.setSubmarinesOpacity(TeamID.TEAM_A, 0.2);
        this.setSubmarinesOpacity(TeamID.TEAM_B, 0.2);

        function pushMoveInfo(submarine: Submarine, to: CellPos, teamID: TeamID, isOpponentAtSameCell: boolean): void {
            const fromX = submarine.x;
            const fromY = submarine.y;
            const {x: toX, y: toY} = SubmarineManager.calcSubmarineDrawnPosConstrainedToCell(
                to, teamID, gridView,
                submarineWidth, submarineHeight,
                isOpponentAtSameCell);
            moveInfos.push({submarine: submarine, fromX: fromX, fromY: fromY, toX: toX, toY: toY});
            submarine.isConstrainedToCell = false;
            submarine.opacity = 1.0;
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

        new TimeRatioTransition(animTimeLength, 100, animTask, onAnimFinishWrap)
            .start();
    }

    countSubmarine(teamID: TeamID): number {
        return this.getSubmarineArrayOfTeam(teamID).length;
    }

    isTeamAWinner(): boolean {
        return this.teamASubmarines.length > 0 && this.teamBSubmarines.length <= 0;
    }

    isTeamBWinner(): boolean {
        return this.teamBSubmarines.length > 0 && this.teamASubmarines.length <= 0;
    }

    setSubmarinesOpacity(teamID: TeamID, opacity: number): void {
        for (const submarine of this.getSubmarineArrayOfTeam(teamID)) {
            submarine.opacity = opacity;
        }
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
                if (submarine.visible == false) continue;

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

        if (this.explosionAnimation != null) {
            this.explosionAnimation.draw(ctx);
        }
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

    getSubmarineAt(pos: CellPos, teamID: TeamID): Submarine | null {
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
        ctx.font = '64px sans-serif'
        ctx.fillText("潜水艦撃沈ゲーム", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 32);
        ctx.font = '32px sans-serif'
        ctx.fillText("クリックして開始します", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 32);
    }

    private _drawBack(ctx: CanvasRenderingContext2D): void {
        ctx.fillStyle = MyColor.backGround;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
}

class OverlayRect {
    constructor(
        readonly row: number,
        readonly col: number,
        readonly fillColor: string,
        public opacity: number,
        public visible: boolean
    ) {
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

    readonly teamAFirstTurnRadioButton: HTMLInputElement;
    readonly teamBFirstTurnRadioButton: HTMLInputElement;
    readonly teamAFirstTurnLabel: HTMLLabelElement;
    readonly teamBFirstTurnLabel: HTMLLabelElement;

    private overlayRect: OverlayRect | null = null;

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

        {
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
        {
            function createRadioButton(name: string): HTMLInputElement {
                const radioButton = document.createElement('input') as HTMLInputElement;
                radioButton.name = name;
                radioButton.type = 'radio';
                return radioButton;
            }

            function createLabelWithinRadioButton(labelValue: string, radio: HTMLInputElement, height: number): HTMLLabelElement {
                const label = document.createElement('label') as HTMLLabelElement;
                label.innerText = labelValue;
                label.prepend(radio);

                label.classList.add('radio');
                radio.style.width = radio.style.height = ((height * 0.8) | 0) + "px";
                label.style.fontSize = height + "px";
                label.style.position = 'absolute';
                return label;
            }

            this.teamAFirstTurnRadioButton = createRadioButton('first-turn-team');
            this.teamBFirstTurnRadioButton = createRadioButton('first-turn-team');
            this.teamAFirstTurnRadioButton.onchange = this._onFirstTurnTeamRadioButtonChange.bind(this);
            this.teamBFirstTurnRadioButton.onchange = this._onFirstTurnTeamRadioButtonChange.bind(this);

            this.teamAFirstTurnLabel = createLabelWithinRadioButton('TeamA先攻', this.teamAFirstTurnRadioButton, 24);
            this.teamBFirstTurnLabel = createLabelWithinRadioButton('TeamB先攻', this.teamBFirstTurnRadioButton, 24);
            this.teamAFirstTurnLabel.style.right = "30px";
            this.teamAFirstTurnLabel.style.bottom = "140px";
            this.teamBFirstTurnLabel.style.right = "30px";
            this.teamBFirstTurnLabel.style.bottom = "100px";
        }
    }

    static setDefaultGuideMessage() {
        setGuideMessage("初期配置を設定してください。各チームにつき ちょうど4隻 配置する必要があります。\nセルをクリックして潜水艦の有無を切り替えられます。", "");
    }

    static setSubmarineCountAllSatisfiedGuideMessage() {
        setGuideMessage("両チームともに配置がちょうど4隻になりました。\n先攻のチームが正しいことを確認してください。[Start Battle] ボタンで対戦を開始します。", "forestgreen");
    }

    setup(): void {
        InitialPositionInputScene.setDefaultGuideMessage();
        this.battleButton.disabled = true;
        this._mouseEventSetup();

        CANVAS_WRAPPER_ELEM.appendChild(this.teamAShowButton);
        CANVAS_WRAPPER_ELEM.appendChild(this.teamBShowButton);
        CANVAS_WRAPPER_ELEM.appendChild(this.battleButton);
        CANVAS_WRAPPER_ELEM.appendChild(this.teamAFirstTurnLabel);
        CANVAS_WRAPPER_ELEM.appendChild(this.teamBFirstTurnLabel);

        window.addEventListener('beforeunload', (evt) => {
            evt.preventDefault();
            evt.returnValue = "";
        })
    }

    tearDown(): void {
        setGuideMessage("", "");
        this.cellEventDispatcher.unhookMeFrom(this.sceneManager.canvas);

        CANVAS_WRAPPER_ELEM.removeChild(this.teamAShowButton);
        CANVAS_WRAPPER_ELEM.removeChild(this.teamBShowButton);
        CANVAS_WRAPPER_ELEM.removeChild(this.battleButton);
        CANVAS_WRAPPER_ELEM.removeChild(this.teamAFirstTurnLabel);
        CANVAS_WRAPPER_ELEM.removeChild(this.teamBFirstTurnLabel);
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
        this._drawOverlayRect(ctx, this.overlayRect);
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
            if (submarineManager.countSubmarine(this.currentTeam) >= 4) {
                setGuideMessage("4隻以上の配置は許されません。\n潜水艦のあるマスをクリックすることでその潜水艦を消すことができます。", "red");

                const fillColor = "#ff9c9c";
                this.overlayRect = new OverlayRect(cell.row, cell.col, fillColor, 1.0, true);
                const overlayRect = this.overlayRect;

                new TimeRatioTransition(300, 0,
                    (ratio: number): boolean => {
                        overlayRect.opacity = 1.0 - ratio;
                        return true;
                    },
                    (): void => {
                        overlayRect.visible = false;
                    }).start();
                return;
            }

            existence[row][col] = true;
            submarineManager.newSubmarineAt(cell, this.currentTeam);
        }

        const isTeamAOK = this.teamASubmarineManager.countSubmarine(TeamID.TEAM_A) == 4;
        const isTeamBOK = this.teamBSubmarineManager.countSubmarine(TeamID.TEAM_B) == 4;

        if (isTeamAOK && isTeamBOK) {
            this.battleButton.disabled = !this._canBattleStart();
            InitialPositionInputScene.setSubmarineCountAllSatisfiedGuideMessage();
        } else {
            this.battleButton.disabled = true;
            if (isTeamAOK && this.currentTeam == TeamID.TEAM_A) {
                setGuideMessage("TeamAの配置がちょうど4隻になりました。\n左上の [TeamBの配置へ] ボタンを押してTeamBの初期配置も設定してください。", "");
            } else if (isTeamBOK && this.currentTeam == TeamID.TEAM_B) {
                setGuideMessage("TeamBの配置がちょうど4隻になりました。\n左上の [TeamAの配置へ] ボタンを押してTeamAの初期配置も設定してください。", "");
            } else {
                InitialPositionInputScene.setDefaultGuideMessage();
            }
        }
    }

    onMouseEnterCell(cell: Cell): void {
    }

    onMouseLeaveCell(cell: Cell): void {
    }

    private _drawBack(ctx: CanvasRenderingContext2D): void {
        if (this.currentTeam == TeamID.TEAM_A) {
            ctx.fillStyle = MyColor.teamA_background;
        } else {
            ctx.fillStyle = MyColor.teamB_background;
        }
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    private _drawOverlayRect(ctx: CanvasRenderingContext2D, overlayRect: OverlayRect | null): void {
        if (overlayRect == null || !overlayRect.visible) {
            return;
        }
        ctx.save();
        ctx.fillStyle = overlayRect.fillColor;
        ctx.globalAlpha = overlayRect.opacity;
        const drawPos = this.gridView.getCellPosition(overlayRect.row, overlayRect.col);
        ctx.fillRect(drawPos.x, drawPos.y, this.gridView.cellWidth, this.gridView.cellHeight);
        ctx.restore();
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

    private _onFirstTurnTeamRadioButtonChange() {
        this.battleButton.disabled = !this._canBattleStart();
    }

    private _mouseEventSetup(): void {
        this.cellEventDispatcher.hookMeInto(this.sceneManager.canvas);
    }

    private _onAnyTeamShowButtonClicked(): void {
        if (this._isTeamAPlacementOK() && this._isTeamBPlacementOK()) {
            InitialPositionInputScene.setSubmarineCountAllSatisfiedGuideMessage();
        } else {
            InitialPositionInputScene.setDefaultGuideMessage();
        }
    }

    private _onTeamAShowButtonClicked(): void {
        this.currentTeam = TeamID.TEAM_A;
        this._onAnyTeamShowButtonClicked();
    }

    private _onTeamBShowButtonClicked(): void {
        this.currentTeam = TeamID.TEAM_B;
        this._onAnyTeamShowButtonClicked();
    }

    private _onBattleButtonClicked(): void {
        if (!this._isTeamAPlacementOK()) {
            setGuideMessage("TeamAの配置が不正です。 ちょうど4隻配置してください。", "red");
            return;
        }
        if (!this._isTeamBPlacementOK()) {
            setGuideMessage("TeamBの配置が不正です。 ちょうど4隻配置してください。", "red");
            return;
        }
        if (!this._isAnyFirstTurnTeamSelected()) {
            setGuideMessage("先攻のチームを選択してください。", "red");
            return;
        }

        const firstTurnTeam = this._getSelectedFirstTurnTeam();
        const nextScene = new BattleScene(this.sceneManager,
            this.teamASubmarineManager.getSubmarineArrayOfTeam(TeamID.TEAM_A),
            this.teamBSubmarineManager.getSubmarineArrayOfTeam(TeamID.TEAM_B),
            firstTurnTeam);
        this.sceneManager.changeScene(nextScene);
    }

    private _canBattleStart(): boolean {
        return (
            this._isTeamAPlacementOK() &&
            this._isTeamBPlacementOK() &&
            this._isAnyFirstTurnTeamSelected());
    }

    private _isTeamAPlacementOK(): boolean {
        return this.teamASubmarineManager.countSubmarine(TeamID.TEAM_A) == 4;
    }

    private _isTeamBPlacementOK(): boolean {
        return this.teamBSubmarineManager.countSubmarine(TeamID.TEAM_B) == 4;
    }

    private _isAnyFirstTurnTeamSelected(): boolean {
        return this._getSelectedFirstTurnTeam() != null;
    }

    private _getSelectedFirstTurnTeam(): TeamID | null {
        if (this.teamAFirstTurnRadioButton.checked) {
            return TeamID.TEAM_A;
        }
        if (this.teamBFirstTurnRadioButton.checked) {
            return TeamID.TEAM_B;
        }
        return null;
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


enum AttackResponse {
    HIT,
    DEAD,
    NEAR,
    MISS
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
        this._drawBack(ctx);
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
                    const opponent = opponentTeamID(this.currentTurn);
                    this.submarineManager.setSubmarinesOpacity(opponent, 0.2);
                    const s = this.submarineManager.getSubmarineAt(c, opponent);
                    if (s != null) s.opacity = 1.0;

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
        if (this.currentState == BattleSceneState.ATTACK_DEST_SELECT) {
            if (this.attackableCellGrid[c.row][c.col] == false) return;
            const s = this.submarineManager.getSubmarineAt(c, opponentTeamID(this.currentTurn));
            if (s != null) {
                s.opacity = 1.0;
            }
        }
    }

    onMouseLeaveCell(c: Cell): void {
        if (this.currentState == BattleSceneState.ATTACK_DEST_SELECT) {
            const s = this.submarineManager.getSubmarineAt(c, opponentTeamID(this.currentTurn));
            if (s != null && !isSameCellPos(s, this.attackDestPos)) {
                s.opacity = 0.2;
            }
        }
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
                const self = this;

                function onAnimFinish(): void {
                    self.incrementTurn();
                    self.enterOpTypeSelectState();
                    if (self.submarineManager.isTeamAWinner() || self.submarineManager.isTeamBWinner()) {
                        self.enterBattleFinishedState();
                    } else {
                        self.enterOpTypeSelectState();
                    }
                }

                this.submarineManager.decrementHPAndAutoDeleteAt(this.attackDestPos, opponentTeamID(this.currentTurn), onAnimFinish);
                this.enterAnimatingState();
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
                break;
            }
        }
    }

    static judgeAttackResult(attackedPos: CellPos, submarines: Submarine[]): AttackResponse {
        function getSubmarineAt(p: CellPos): Submarine | null {
            return submarines.find(submarine => isSameCellPos(submarine, p));
        }

        const attackedSubmarine = getSubmarineAt(attackedPos);
        if (attackedSubmarine != null) {
            return attackedSubmarine.hp == 1 ? AttackResponse.DEAD : AttackResponse.HIT;
        }

        for (let row = attackedPos.row - 1; row <= attackedPos.row + 1; ++row) {
            for (let col = attackedPos.col - 1; col <= attackedPos.col + 1; ++col) {
                if (row < 0 || col < 0 || row >= N || col >= N) continue;
                if (getSubmarineAt({row: row, col: col}) != null) {
                    return AttackResponse.NEAR;
                }
            }
        }
        return AttackResponse.MISS;
    }

    enterOpTypeSelectState(): void {
        this.currentState = BattleSceneState.OP_TYPE_SELECT;
        this.setButtonDisplayStyle(false, true, true, false);
        this.resetCellsStyle();
        this.submarineManager.setSubmarinesOpacity(this.currentTurn, 1.0);
        this.submarineManager.setSubmarinesOpacity(opponentTeamID(this.currentTurn), 0.5);
        setGuideMessage("攻撃または移動のどちらかのボタンを押してください。", "");
    }

    enterAttackDestSelectState(): void {
        this.currentState = BattleSceneState.ATTACK_DEST_SELECT;
        this.setButtonDisplayStyle(true, false, false, true);
        this.applyButton.disabled = true;
        this.highlightAttackableCells();
        this.submarineManager.setSubmarinesOpacity(this.currentTurn, 0.2);
        this.submarineManager.setSubmarinesOpacity(opponentTeamID(this.currentTurn), 0.2);
        setGuideMessage("攻撃先のマスをクリックして Apply ボタンを押してください。", "");
    }

    enterMoveActorSelectState(): void {
        this.currentState = BattleSceneState.MOVE_ACTOR_SELECT;
        this.setButtonDisplayStyle(true, false, false, true);
        this.applyButton.disabled = true;
        this.highlightMoveActorCandidateCells();
        this.submarineManager.setSubmarinesOpacity(this.currentTurn, 1.0);
        this.submarineManager.setSubmarinesOpacity(opponentTeamID(this.currentTurn), 0.2);
        setGuideMessage("移動する潜水艦をクリックしてください。", "");
    }

    enterMoveDestSelectState(): void {
        this.currentState = BattleSceneState.MOVE_DEST_SELECT;
        this.setButtonDisplayStyle(true, false, false, true);
        this.applyButton.disabled = true;
        this.highlightMoveDestCandidateCells();
        setGuideMessage("移動先のマスをクリックして Apply ボタンを押してください。\n潜水艦をクリックすれば移動する潜水艦を変えることができます。", "");
    }

    enterAnimatingState(): void {
        this.currentState = BattleSceneState.ANIMATING;
        this.setButtonDisplayStyle(false, false, false, false);
        this.applyButton.disabled = true;
        this.resetCellsStyle();
        setGuideMessage("", "");
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
        setGuideMessage("チーム " + winnerTeamName + " の皆さんおめでとうございます🎉🎉🎉", "forestgreen");
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
            cell.mouseCursorStyle = 'default';
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

    private _drawBack(ctx: CanvasRenderingContext2D): void {
        if (this.currentTurn == TeamID.TEAM_A) {
            ctx.fillStyle = MyColor.teamA_background;
        } else {
            ctx.fillStyle = MyColor.teamB_background;
        }
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

        const title = "#" + zeroPadding(this.currentTurnCount, 2) + "  " + teamName + " のターン";

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
