// Triangulo unico que cubre la pantalla (mas barato que dos triangulos de un
// quad: evita la costura diagonal y una invocacion extra de vertice).
attribute vec2 aPosition;

varying vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
