package com.kindmops.chickenjump;

import android.app.Activity;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.MotionEvent;
import android.view.View;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Random;

public final class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        setContentView(new GameView());
    }

    private final class GameView extends View {
        private static final int COIN = 0;
        private static final int ANVIL = 1;

        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Random random = new Random();
        private final ArrayList<FallingObject> objects = new ArrayList<>();
        private final ArrayList<Triangle> triangles = new ArrayList<>();

        private float chickenX = 0.5f;
        private long lastFrame;
        private float spawnTimer;
        private int balance;
        private boolean gameOver;
        private boolean dragging;

        GameView() {
            super(MainActivity.this);
            setLayerType(View.LAYER_TYPE_SOFTWARE, null);
        }

        private final class FallingObject {
            int type;
            float x;
            float y;
            float speed;
            float rotation;
        }

        private final class Triangle {
            final float[] x = new float[3];
            final float[] y = new float[3];
            float depth;
            int color;
        }

        private void setFill(int color) {
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(color);
        }

        private void resetGame() {
            objects.clear();
            chickenX = 0.5f;
            spawnTimer = 0;
            balance = 0;
            gameOver = false;
            dragging = false;
            lastFrame = 0;
            invalidate();
        }

        private void spawnObject() {
            FallingObject object = new FallingObject();
            object.type = random.nextFloat() < 0.42f ? COIN : ANVIL;
            object.x = 0.08f + random.nextFloat() * 0.84f;
            object.y = -0.10f;
            object.speed = 0.25f + random.nextFloat() * 0.10f;
            object.rotation = random.nextFloat() * 360f;
            objects.add(object);
        }

        private void update(float dt) {
            if (gameOver) {
                return;
            }

            spawnTimer -= dt;
            if (spawnTimer <= 0) {
                spawnObject();
                spawnTimer = 0.55f + random.nextFloat() * 0.35f;
            }

            // Координаты объектов нормализованы относительно размера экрана.
            for (int i = objects.size() - 1; i >= 0; i--) {
                FallingObject object = objects.get(i);
                object.y += object.speed * dt;
                object.rotation += 90f * dt;

                float dx = (object.x - chickenX) * getWidth();
                float dy = (object.y - 0.78f) * getHeight();
                float radius = Math.min(getWidth(), getHeight()) * 0.10f;

                if (dx * dx + dy * dy < radius * radius) {
                    objects.remove(i);

                    if (object.type == COIN) {
                        balance += 10;
                    } else {
                        gameOver = true;
                        dragging = false;
                        break;
                    }
                } else if (object.y > 1.1f) {
                    objects.remove(i);
                }
            }
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);

            long now = SystemClock.uptimeMillis();
            float dt = lastFrame == 0 ? 0 : (now - lastFrame) / 1000f;
            lastFrame = now;
            dt = Math.min(dt, 0.05f);
            update(dt);

            float w = getWidth();
            float h = getHeight();
            float unit = Math.min(w, h);

            drawBackground(canvas, w, h);

            for (FallingObject object : objects) {
                float x = object.x * w;
                float y = object.y * h;

                if (object.type == COIN) {
                    drawCoin(canvas, x, y, unit * 0.045f, object.rotation);
                } else {
                    drawAnvil(canvas, x, y, unit * 0.105f);
                }
            }

            drawChicken(canvas, chickenX * w, h * 0.78f, unit * 0.19f);

            setFill(Color.argb(190, 30, 45, 56));
            canvas.drawRoundRect(
                    unit * 0.025f, unit * 0.025f,
                    unit * 0.48f, unit * 0.12f,
                    unit * 0.025f, unit * 0.025f, paint);

            setFill(Color.WHITE);
            paint.setTextAlign(Paint.Align.LEFT);
            paint.setTextSize(unit * 0.046f);
            canvas.drawText("Баланс: " + balance, unit * 0.045f,
                    unit * 0.088f, paint);

            if (gameOver) {
                setFill(Color.argb(180, 0, 0, 0));
                canvas.drawRect(0, 0, w, h, paint);

                setFill(Color.WHITE);
                paint.setTextAlign(Paint.Align.CENTER);
                paint.setTextSize(unit * 0.075f);
                canvas.drawText("Игра окончена", w / 2f, h * 0.42f, paint);
                paint.setTextSize(unit * 0.05f);
                canvas.drawText("Баланс: " + balance, w / 2f, h * 0.49f, paint);
                canvas.drawText("Нажми, чтобы начать заново",
                        w / 2f, h * 0.57f, paint);
            } else {
                postInvalidateOnAnimation();
            }
        }

        private void drawBackground(Canvas canvas, float w, float h) {
            canvas.drawColor(Color.rgb(150, 215, 250));

            setFill(Color.rgb(215, 244, 255));
            canvas.drawCircle(w * 0.17f, h * 0.16f, w * 0.07f, paint);
            canvas.drawCircle(w * 0.23f, h * 0.16f, w * 0.09f, paint);
            canvas.drawCircle(w * 0.75f, h * 0.24f, w * 0.08f, paint);
            canvas.drawCircle(w * 0.82f, h * 0.24f, w * 0.06f, paint);

            setFill(Color.rgb(111, 190, 93));
            canvas.drawRect(0, h * 0.85f, w, h, paint);

            setFill(Color.rgb(83, 162, 72));
            canvas.drawRect(0, h * 0.85f, w, h * 0.87f, paint);
        }

        private void drawCoin(Canvas canvas, float x, float y,
                              float radius, float rotation) {
            float width = radius * (0.35f
                    + 0.65f * Math.abs((float) Math.cos(Math.toRadians(rotation))));

            setFill(Color.rgb(164, 100, 12));
            canvas.drawOval(x - width, y - radius,
                    x + width, y + radius, paint);

            setFill(Color.rgb(255, 204, 45));
            canvas.drawOval(x - width * 0.8f, y - radius * 0.85f,
                    x + width * 0.8f, y + radius * 0.85f, paint);

            if (width > radius * 0.6f) {
                setFill(Color.rgb(155, 99, 12));
                paint.setTextAlign(Paint.Align.CENTER);
                paint.setTextSize(radius * 0.95f);
                canvas.drawText("+", x, y + radius * 0.32f, paint);
            }
        }

        private void drawAnvil(Canvas canvas, float x, float y, float size) {
            canvas.save();
            canvas.translate(x, y);

            // Боковая грань.
            setFill(Color.rgb(49, 57, 69));
            Path side = new Path();
            side.moveTo(-size * 0.48f, -size * 0.16f);
            side.lineTo(size * 0.48f, -size * 0.16f);
            side.lineTo(size * 0.32f, size * 0.05f);
            side.lineTo(size * 0.25f, size * 0.30f);
            side.lineTo(size * 0.37f, size * 0.40f);
            side.lineTo(-size * 0.37f, size * 0.40f);
            side.lineTo(-size * 0.25f, size * 0.30f);
            side.lineTo(-size * 0.32f, size * 0.05f);
            side.close();
            canvas.drawPath(side, paint);

            // Освещённая верхняя грань.
            setFill(Color.rgb(132, 146, 160));
            Path top = new Path();
            top.moveTo(-size * 0.58f, -size * 0.30f);
            top.lineTo(size * 0.35f, -size * 0.30f);
            top.lineTo(size * 0.56f, -size * 0.19f);
            top.lineTo(size * 0.48f, -size * 0.16f);
            top.lineTo(-size * 0.48f, -size * 0.16f);
            top.close();
            canvas.drawPath(top, paint);

            setFill(Color.rgb(87, 99, 113));
            canvas.drawRect(-size * 0.37f, size * 0.30f,
                    size * 0.37f, size * 0.40f, paint);

            canvas.restore();
        }

        /*
         * Простая программная 3D-модель: эллипсоиды разбиваются на
         * треугольники, затем проецируются на экран и сортируются по глубине.
         */
        private void drawChicken(Canvas canvas, float cx, float cy, float size) {
            setFill(Color.argb(50, 30, 45, 25));
            canvas.drawOval(cx - size * 0.65f, cy + size * 0.44f,
                    cx + size * 0.65f, cy + size * 0.59f, paint);

            triangles.clear();

            // Координаты модели: X — вправо, Y — вверх, Z — к зрителю.
            addEllipsoid(0, -0.02f, 0, 0.55f, 0.48f, 0.38f,
                    Color.rgb(250, 245, 220));
            addEllipsoid(0, 0.43f, 0.04f, 0.33f, 0.34f, 0.30f,
                    Color.rgb(255, 251, 230));

            // Крылья, лапки и гребешок.
            addEllipsoid(-0.48f, 0.00f, 0.13f, 0.19f, 0.29f, 0.15f,
                    Color.rgb(231, 222, 193));
            addEllipsoid(0.48f, 0.00f, 0.13f, 0.19f, 0.29f, 0.15f,
                    Color.rgb(231, 222, 193));
            addEllipsoid(-0.22f, -0.45f, 0.08f, 0.16f, 0.08f, 0.19f,
                    Color.rgb(230, 142, 35));
            addEllipsoid(0.22f, -0.45f, 0.08f, 0.16f, 0.08f, 0.19f,
                    Color.rgb(230, 142, 35));
            addEllipsoid(-0.09f, 0.75f, 0.03f, 0.10f, 0.14f, 0.08f,
                    Color.rgb(220, 52, 45));
            addEllipsoid(0.08f, 0.76f, 0.03f, 0.10f, 0.15f, 0.08f,
                    Color.rgb(220, 52, 45));

            // Клюв и глаза находятся на обращённой к зрителю стороне.
            addEllipsoid(0, 0.34f, 0.33f, 0.15f, 0.09f, 0.13f,
                    Color.rgb(241, 159, 35));
            addEllipsoid(-0.15f, 0.51f, 0.29f, 0.035f, 0.045f, 0.03f,
                    Color.rgb(25, 25, 25));
            addEllipsoid(0.15f, 0.51f, 0.29f, 0.035f, 0.045f, 0.03f,
                    Color.rgb(25, 25, 25));

            Collections.sort(triangles, new Comparator<Triangle>() {
                @Override
                public int compare(Triangle a, Triangle b) {
                    return Float.compare(a.depth, b.depth);
                }
            });

            Path path = new Path();
            for (Triangle triangle : triangles) {
                path.reset();
                path.moveTo(cx + triangle.x[0] * size,
                        cy - triangle.y[0] * size);
                path.lineTo(cx + triangle.x[1] * size,
                        cy - triangle.y[1] * size);
                path.lineTo(cx + triangle.x[2] * size,
                        cy - triangle.y[2] * size);
                path.close();
                setFill(triangle.color);
                canvas.drawPath(path, paint);
            }
        }

        private void addEllipsoid(float cx, float cy, float cz,
                                  float rx, float ry, float rz, int baseColor) {
            final int latitudes = 10;
            final int longitudes = 16;

            for (int lat = 0; lat < latitudes; lat++) {
                double a0 = -Math.PI / 2 + Math.PI * lat / latitudes;
                double a1 = -Math.PI / 2 + Math.PI * (lat + 1) / latitudes;

                for (int lon = 0; lon < longitudes; lon++) {
                    double b0 = 2 * Math.PI * lon / longitudes;
                    double b1 = 2 * Math.PI * (lon + 1) / longitudes;

                    float[] p00 = point(cx, cy, cz, rx, ry, rz, a0, b0);
                    float[] p01 = point(cx, cy, cz, rx, ry, rz, a0, b1);
                    float[] p10 = point(cx, cy, cz, rx, ry, rz, a1, b0);
                    float[] p11 = point(cx, cy, cz, rx, ry, rz, a1, b1);

                    addTriangle(p00, p10, p11, cx, cy, cz, rx, ry, rz, baseColor);
                    addTriangle(p00, p11, p01, cx, cy, cz, rx, ry, rz, baseColor);
                }
            }
        }

        private float[] point(float cx, float cy, float cz,
                              float rx, float ry, float rz,
                              double latitude, double longitude) {
            float cosLat = (float) Math.cos(latitude);
            return new float[] {
                    cx + rx * cosLat * (float) Math.cos(longitude),
                    cy + ry * (float) Math.sin(latitude),
                    cz + rz * cosLat * (float) Math.sin(longitude)
            };
        }

        private void addTriangle(float[] a, float[] b, float[] c,
                                 float cx, float cy, float cz,
                                 float rx, float ry, float rz, int baseColor) {
            Triangle triangle = new Triangle();
            float[][] vertices = {a, b, c};

            float mx = (a[0] + b[0] + c[0]) / 3f;
            float my = (a[1] + b[1] + c[1]) / 3f;
            float mz = (a[2] + b[2] + c[2]) / 3f;

            // Нормаль к эллипсоиду для простого освещения.
            float nx = (mx - cx) / (rx * rx);
            float ny = (my - cy) / (ry * ry);
            float nz = (mz - cz) / (rz * rz);
            float length = (float) Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (length == 0) {
                return;
            }
            nx /= length;
            ny /= length;
            nz /= length;

            float light = Math.max(0, nx * -0.35f + ny * 0.55f + nz * 0.76f);
            float brightness = 0.48f + 0.52f * light;
            triangle.color = Color.rgb(
                    Math.min(255, (int) (Color.red(baseColor) * brightness)),
                    Math.min(255, (int) (Color.green(baseColor) * brightness)),
                    Math.min(255, (int) (Color.blue(baseColor) * brightness)));

            triangle.depth = mz;
            for (int i = 0; i < 3; i++) {
                // Небольшой наклон камеры сверху.
                triangle.x[i] = vertices[i][0];
                triangle.y[i] = vertices[i][1] - vertices[i][2] * 0.18f;
            }
            triangles.add(triangle);
        }

        @Override
        public boolean onTouchEvent(MotionEvent event) {
            int action = event.getActionMasked();

            if (action == MotionEvent.ACTION_DOWN) {
                if (gameOver) {
                    resetGame();
                    performClick();
                    return true;
                }

                dragging = true;
                moveChicken(event.getX());
                return true;
            }

            if (action == MotionEvent.ACTION_MOVE && dragging) {
                moveChicken(event.getX());
                return true;
            }

            if (action == MotionEvent.ACTION_UP) {
                dragging = false;
                performClick();
                return true;
            }

            if (action == MotionEvent.ACTION_CANCEL) {
                dragging = false;
                return true;
            }

            return true;
        }

        private void moveChicken(float x) {
            if (getWidth() > 0) {
                chickenX = Math.max(0.10f, Math.min(0.90f, x / getWidth()));
                invalidate();
            }
        }

        @Override
        public boolean performClick() {
            super.performClick();
            return true;
        }

        @Override
        protected void onDetachedFromWindow() {
            super.onDetachedFromWindow();
            lastFrame = 0;
        }
    }
}
