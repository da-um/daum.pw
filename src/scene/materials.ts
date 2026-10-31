import { ShaderMaterial, Vector2, Vector3 } from 'three';
import { C, type RGB } from '../lib/palette';

// Every material is flat: one solid color per face, no lights.
// The canvas renders with no color conversion, so colors are raw sRGB.

const v3 = (c: RGB) => new Vector3(...c);

const basicVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec2 vPos;
  void main() {
    vUv = uv;
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * A plate: cream under the 135° amber -> orange wash at some strength, with
 * an optional rounded-rect hole. Coordinates are plate-local world units, so
 * pieces of one plate share a continuous wash. uScreen = 1 lays the wash in
 * screen space instead, matching the CSS page background exactly. uTintMix
 * fades the whole plate to a tint running from uTintFrom to uTintTo across
 * uTintBox (x, top y, w, h), left to right.
 */
export function plateMaterial() {
  return new ShaderMaterial({
    transparent: true,
    uniforms: {
      uCream: { value: v3(C.cream) },
      uAmber: { value: v3(C.amber) },
      uOrange: { value: v3(C.orange) },
      uWash: { value: 0 },
      uSpan: { value: new Vector2(1, 1) },
      uSize: { value: new Vector2(1, 1) },
      uGradSpan: { value: 2600 },
      uHole: { value: new Vector2(0, 0) },
      uHoleOff: { value: new Vector2(0, 0) },
      uRadius: { value: 0 },
      uScreen: { value: 0 },
      uRes: { value: new Vector2(1, 1) },
      uOpacity: { value: 1 },
      uTintFrom: { value: v3(C.cream) },
      uTintTo: { value: v3(C.cream) },
      uTintBox: { value: [0, 0, 1, 1] },
      uTintMix: { value: 0 },
    },
    vertexShader: basicVertex,
    fragmentShader: /* glsl */ `
      uniform vec3 uCream, uAmber, uOrange, uTintFrom, uTintTo;
      uniform float uWash, uGradSpan, uRadius, uScreen, uOpacity, uTintMix;
      uniform vec4 uTintBox;
      uniform vec2 uSpan, uSize, uHole, uHoleOff, uRes;
      varying vec2 vPos;

      float roundRect(vec2 p, vec2 b, float r) {
        vec2 q = abs(p) - b + r;
        return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
      }

      void main() {
        // Plate-local position in world units.
        vec2 q = vPos / uSpan * uSize;
        float a = uOpacity;
        if (uHole.x > 0.0 && uHole.y > 0.0) {
          float d = roundRect(q - uHoleOff, uHole, min(uRadius, min(uHole.x, uHole.y)));
          float w = fwidth(d);
          a *= smoothstep(-w, w, d);
        }
        if (a < 0.002) discard;
        // CSS 135deg: t runs along the diagonal of the box, normalized by w + h.
        vec2 f = gl_FragCoord.xy;
        float ts = 0.5 + (f.x - uRes.x * 0.5 + uRes.y * 0.5 - f.y) / (uRes.x + uRes.y);
        float tl = 0.5 + (q.x - q.y) / (2.0 * uGradSpan);
        float t = clamp(mix(tl, ts, uScreen), 0.0, 1.0);
        vec3 page = mix(uCream, mix(uAmber, uOrange, t), uWash);
        vec3 tint = mix(uTintFrom, uTintTo, clamp((q.x - uTintBox.x) / uTintBox.z, 0.0, 1.0));
        gl_FragColor = vec4(mix(page, tint, uTintMix), a);
      }
    `,
  });
}

/** Solid color, or a gradient from `from` to `to` across a box, left to right. */
export function flatMaterial(color: RGB, grad?: { box: { x: number; w: number }; from: RGB; to: RGB }) {
  return new ShaderMaterial({
    transparent: true,
    uniforms: {
      uColor: { value: v3(color) },
      uFrom: { value: v3(grad?.from ?? color) },
      uTo: { value: v3(grad?.to ?? color) },
      uGrad: { value: grad ? 1 : 0 },
      uBox: { value: new Vector2(grad?.box.x ?? 0, grad?.box.w ?? 1) },
      uOpacity: { value: 1 },
    },
    vertexShader: basicVertex,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor, uFrom, uTo;
      uniform float uGrad, uOpacity;
      uniform vec2 uBox;
      varying vec2 vPos;
      void main() {
        float t = clamp((vPos.x - uBox.x) / uBox.y, 0.0, 1.0);
        gl_FragColor = vec4(mix(uColor, mix(uFrom, uTo, t), uGrad), uOpacity);
      }
    `,
  });
}

/** Instanced flat shapes with a per-instance color. */
export function instanceMaterial(opacity = 1) {
  return new ShaderMaterial({
    transparent: opacity < 1,
    uniforms: { uOpacity: { value: opacity } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      varying vec3 vColor;
      void main() {
        vColor = aColor;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vColor;
      void main() { gl_FragColor = vec4(vColor, uOpacity); }
    `,
  });
}
