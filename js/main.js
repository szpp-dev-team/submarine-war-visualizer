const CANVAS_WIDTH = 860;
const CANVAS_HEIGHT = 640;
const N = 5;
class Geometry {
    static centerPos(elementLength, containerLength) {
        return (containerLength - elementLength) / 2;
    }
}
class MyColor {
}
MyColor.lightGray = '#eee';
MyColor.darkGray = '#333';
MyColor.submarine_red = '#CB2400';
MyColor.submarine_blue = '#236CCA';
class Visualizer {
    constructor(canvas, scene) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.curScene = scene;
        this.canvas.width = CANVAS_WIDTH;
        this.canvas.height = CANVAS_HEIGHT;
        scene.setup(this);
        this.ctx.textAlign = 'center';
    }
    run() {
        const animationLoop = (timestamp) => {
            this.curScene.update(timestamp);
            this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            this.curScene.draw(this.ctx);
            requestAnimationFrame(animationLoop);
        };
        requestAnimationFrame(animationLoop);
    }
    changeScene(nextScene) {
        this.curScene.tearDown();
        this.curScene = nextScene;
        this.curScene.setup(this);
    }
}
class TitleScene {
    constructor() {
        this.clickHandler = () => {
            console.log("[TitleScene#clickHandler] Clicked!");
            let battleScene = new BattleScene();
            this.sceneChanger.changeScene(battleScene);
        };
    }
    setup(sceneChanger) {
        this.sceneChanger = sceneChanger;
        this.sceneChanger.canvas.addEventListener('click', this.clickHandler, false);
    }
    tearDown() {
        this.sceneChanger.canvas.removeEventListener('click', this.clickHandler, false);
    }
    update(timestamp) {
    }
    draw(ctx) {
        this._draw_back(ctx);
        this._draw_message(ctx);
    }
    _draw_message(ctx) {
        ctx.fillStyle = MyColor.darkGray;
        ctx.font = '32px sans-serif';
        const msg = "潜水艦の初期配置を入力してOKボタンを押してください";
        ctx.fillText(msg, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }
    _draw_back(ctx) {
        ctx.fillStyle = MyColor.lightGray;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
}
class BattleScene {
    setup(sceneChanger) {
    }
    tearDown() {
    }
    update(timestamp) {
    }
    draw(ctx) {
        this._draw_back(ctx);
        this._draw_message(ctx);
    }
    _draw_message(ctx) {
        ctx.fillStyle = MyColor.darkGray;
        ctx.font = '32px sans-serif';
        const msg = "Battle Scene";
        ctx.fillText(msg, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }
    _draw_back(ctx) {
        ctx.fillStyle = MyColor.lightGray;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
}
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('main-canvas');
    const titleScene = new TitleScene();
    const visualizer = new Visualizer(canvas, titleScene);
    visualizer.run();
});
//# sourceMappingURL=main.js.map