// 内置程序化宠物（builtin 包）：零外部素材，canvas 参数化绘制。
// 画布与 dsh-pet 素材约定一致：640×360，脚底线 y=330（FEET_Y），命中框 HIT_BOX 兼容。
// 动作名即配置里的动画名（中文直用）；finite 动画自带时长，renderer 据此触发 ended。
const CANVAS_W = 640;
const CANVAS_H = 360;
const FEET_Y = 330;

/** finite 动画时长（秒）；不在表内 = 循环动画 */
export const BUILTIN_DURATIONS = {
  "点击弹跳": 0.7,
  "摇摆": 0.9,
  "转圈": 0.8,
  "转身": 0.35,
  "庆祝": 1.2,
  "说话": 2.0,
  "余额-开心": 1.2,
  "余额-难过": 1.5,
};

const TAU = Math.PI * 2;

export class BuiltinPainter {
  constructor(ctx) {
    this.ctx = ctx;
    this.action = "待机";
  }
  start(name) {
    this.action = BUILTIN_DURATIONS[name] !== undefined || this.#known(name) ? name : "待机";
  }
  #known(name) {
    return [
      "待机", "拖拽", "溜达", "思考", "打字", "整理", "打盹", "晕", "说话",
      "点击弹跳", "摇摆", "转圈", "转身", "庆祝", "余额-开心", "余额-难过",
    ].includes(name);
  }
  duration(name) {
    return BUILTIN_DURATIONS[name] ?? null;
  }

  /**
   * 绘制一帧。
   * @param t 动画已播秒数（renderer 传入 elapsed）
   * @param facing 'left' | 'right'
   * @param squash 1 = 原始；<1 = 垂直压扁（Q 弹曲线值）
   */
  draw(t, facing, squash = 1) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.save();
    // 镜像：right = 素材原样的镜像（dsh 语义：left 为素材原样）
    if (facing === "right") {
      ctx.translate(CANVAS_W, 0);
      ctx.scale(-1, 1);
    }
    // Q 弹：以脚底为轴压扁
    const sq = Math.max(0.35, Math.min(1.12, squash));
    ctx.translate(320, FEET_Y);
    ctx.scale(1 / Math.sqrt(sq), sq);
    ctx.translate(-320, -FEET_Y);

    const u = t; // 本动作时间
    const action = this.action;
    let bodyY = 0;
    let rot = 0;
    let jump = 0;

    switch (action) {
      case "点击弹跳":
      case "庆祝": {
        const dur = action === "庆祝" ? 1.2 : 0.7;
        const p = Math.min(u / dur, 1);
        jump = -Math.sin(Math.PI * Math.min(p * (action === "庆祝" ? 2 : 1), 1)) * 90;
        rot = Math.sin(p * TAU * 2) * 0.06;
        break;
      }
      case "转圈":
        rot = Math.min(u / 0.8, 1) * TAU;
        break;
      case "摇摆":
        rot = Math.sin(u * TAU * 2.2) * 0.18;
        break;
      case "溜达":
        bodyY = Math.abs(Math.sin(u * TAU * 1.6)) * -8;
        break;
      case "拖拽":
        rot = Math.sin(u * TAU * 6) * 0.1;
        break;
      case "晕":
        rot = Math.sin(u * TAU * 1.2) * 0.12;
        break;
      case "余额-难过":
        bodyY = 6;
        break;
      default:
        bodyY = Math.sin(u * TAU * 0.45) * -4; // 待机呼吸
    }

    ctx.translate(0, bodyY + jump);
    ctx.translate(320, 300);
    ctx.rotate(rot);
    ctx.translate(-320, -300);

    this.#drawBody(ctx, action, u);
    this.#drawFace(ctx, action, u);
    this.#drawProps(ctx, action, u);
    ctx.restore();
  }

  #drawBody(ctx, action, u) {
    // 身体：圆角胖水滴
    const grad = ctx.createLinearGradient(240, 180, 400, 320);
    grad.addColorStop(0, "#ffd76e");
    grad.addColorStop(1, "#ff9f5a");
    ctx.fillStyle = grad;
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(320, 262, 108, 96, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // 肚皮高光
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.ellipse(292, 240, 40, 30, -0.4, 0, TAU);
    ctx.fill();
    // 脚
    ctx.fillStyle = "#e88b45";
    const step = action === "溜达" ? Math.sin(u * TAU * 1.6) * 10 : 0;
    ctx.beginPath();
    ctx.ellipse(284 + step, FEET_Y - 6, 26, 12, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(356 - step, FEET_Y - 6, 26, 12, 0, 0, TAU);
    ctx.fill();
    // 手
    ctx.strokeStyle = "#e88b45";
    ctx.lineWidth = 14;
    ctx.lineCap = "round";
    if (action === "庆祝" || action === "余额-开心") {
      const raise = Math.sin(Math.min(u / 0.3, 1) * Math.PI / 2) * 30;
      ctx.beginPath();
      ctx.moveTo(228, 250);
      ctx.lineTo(204, 190 - raise);
      ctx.moveTo(412, 250);
      ctx.lineTo(436, 190 - raise);
      ctx.stroke();
    } else if (action === "打字" || action === "整理") {
      const tap = Math.sin(u * TAU * 5) * 8;
      ctx.beginPath();
      ctx.moveTo(232, 262);
      ctx.lineTo(206, 292 + tap);
      ctx.moveTo(408, 262);
      ctx.lineTo(434, 292 - tap);
      ctx.stroke();
    } else {
      const sway = action === "拖拽" ? Math.sin(u * TAU * 6) * 24 : 0;
      ctx.beginPath();
      ctx.moveTo(228, 258);
      ctx.lineTo(200, 296 + sway);
      ctx.moveTo(412, 258);
      ctx.lineTo(440, 296 - sway);
      ctx.stroke();
    }
  }

  #drawFace(ctx, action, u) {
    const eye = (cx) => {
      if (action === "打盹" || action === "余额-难过") {
        // 闭眼弧
        ctx.strokeStyle = "#2b2b2b";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(cx, 236, 12, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
        return;
      }
      if (action === "晕") {
        ctx.strokeStyle = "#2b2b2b";
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let a = 0; a < TAU * 1.5; a += 0.3) {
          const r = 3 + a * 2.2;
          const px = cx + Math.cos(a + u * 6) * r;
          const py = 236 + Math.sin(a + u * 6) * r;
          a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.stroke();
        return;
      }
      const blink = (u % 3.4) < 0.12 ? 0.12 : 1;
      ctx.fillStyle = "#2b2b2b";
      ctx.beginPath();
      ctx.ellipse(cx, 236, 9, 11 * blink, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(cx + 3, 232, 3 * blink, 0, TAU);
      ctx.fill();
    };
    eye(280);
    eye(360);
    // 腮红
    ctx.fillStyle = "rgba(255,110,110,0.4)";
    ctx.beginPath();
    ctx.ellipse(252, 262, 14, 7, 0, 0, TAU);
    ctx.ellipse(388, 262, 14, 7, 0, 0, TAU);
    ctx.fill();
    // 嘴
    ctx.strokeStyle = "#2b2b2b";
    ctx.fillStyle = "#2b2b2b";
    ctx.lineWidth = 5;
    if (action === "说话") {
      const open = 8 + Math.sin(u * TAU * 4) * 6;
      ctx.beginPath();
      ctx.ellipse(320, 284, 14, open, 0, 0, TAU);
      ctx.fill();
    } else if (action === "晕" || action === "余额-难过") {
      ctx.beginPath();
      ctx.arc(320, 296, 12, 1.15 * Math.PI, 1.85 * Math.PI);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(320, 278, 14, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  }

  #drawProps(ctx, action, u) {
    if (action === "思考") {
      const a = 0.6 + Math.sin(u * 2) * 0.2;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.strokeStyle = "rgba(120,120,140,0.7)";
      ctx.lineWidth = 2;
      for (const [bx, by, r] of [[430, 170, 6], [456, 146, 9], [492, 116, 26]]) {
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
    }
    if (action === "打字") {
      ctx.fillStyle = "#8a94a6";
      ctx.fillRect(250, 316, 140, 12);
      ctx.fillStyle = "#5b6472";
      ctx.fillRect(258, 288, 124, 30);
    }
    if (action === "整理") {
      ctx.strokeStyle = `rgba(255,220,90,${0.5 + Math.sin(u * 8) * 0.4})`;
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        const a = u * 4 + (i * TAU) / 3;
        const sx = 460 + Math.cos(a) * 8;
        const sy = 200 + Math.sin(a) * 8;
        ctx.beginPath();
        ctx.moveTo(sx - 8, sy);
        ctx.lineTo(sx + 8, sy);
        ctx.moveTo(sx, sy - 8);
        ctx.lineTo(sx, sy + 8);
        ctx.stroke();
      }
    }
    if (action === "打盹") {
      ctx.fillStyle = "rgba(140,150,180,0.85)";
      ctx.font = "26px sans-serif";
      for (let i = 0; i < 3; i++) {
        const p = (u * 0.5 + i * 0.33) % 1;
        ctx.globalAlpha = 1 - p;
        ctx.fillText("z", 420 + p * 30, 190 - p * 60);
      }
      ctx.globalAlpha = 1;
    }
    if (action === "晕") {
      ctx.strokeStyle = "rgba(255,200,60,0.9)";
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        const a = u * 3 + (i * TAU) / 3;
        ctx.beginPath();
        ctx.arc(320 + Math.cos(a) * 120, 160 + Math.sin(a) * 24, 8, 0, TAU);
        ctx.stroke();
      }
    }
    if (action === "庆祝" || action === "余额-开心") {
      ctx.fillStyle = `rgba(255,210,70,${0.5 + Math.sin(u * 10) * 0.4})`;
      for (let i = 0; i < 6; i++) {
        const a = (i * TAU) / 6 + u * 2;
        ctx.beginPath();
        ctx.arc(320 + Math.cos(a) * 150, 200 + Math.sin(a) * 90, 6, 0, TAU);
        ctx.fill();
      }
    }
    if (action === "余额-难过") {
      ctx.fillStyle = "rgba(110,160,255,0.85)";
      ctx.beginPath();
      ctx.ellipse(412, 226 + Math.sin(u * 3) * 4, 7, 10, 0.4, 0, TAU);
      ctx.fill();
    }
  }
}
