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

public final class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        setContentView(new GameView());
    }

    private final class GameView extends View {
        private static final long JUMP_MS = 600;

        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private long jumpStarted = -1;
        private int jumps = 0;

        GameView() {
            super(MainActivity.this);
        }

        private void color(int value) {
            paint.setColor(value);
            paint.setStyle(Paint.Style.FILL);
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);

            float w = getWidth();
            float h = getHeight();
            float size = Math.min(w, h) * 0.32f;
            float cx = w / 2f;
            float ground = h * 0.78f;
            float lift = 0;

            if (jumpStarted >= 0) {
                float t = (SystemClock.uptimeMillis() - jumpStarted)
                        / (float) JUMP_MS;
                if (t >= 1f) {
                    jumpStarted = -1;
                } else {
                    lift = (float) Math.sin(Math.PI * t) * size * 0.8f;
                    postInvalidateOnAnimation();
                }
            }

            canvas.drawColor(Color.rgb(174, 224, 255));

            color(Color.rgb(100, 185, 88));
            canvas.drawRect(0, ground, w, h, paint);

            color(Color.rgb(55, 85, 60));
            paint.setTextAlign(Paint.Align.CENTER);
            paint.setTextSize(size * 0.16f);
            canvas.drawText("Нажми на курицу!", cx, h * 0.14f, paint);
            canvas.drawText("Прыжков: " + jumps, cx, h * 0.19f, paint);

            float cy = ground - size * 0.45f - lift;

            // Лапки.
            color(Color.rgb(232, 144, 42));
            canvas.drawRoundRect(cx - size * 0.22f, cy + size * 0.27f,
                    cx - size * 0.12f, cy + size * 0.47f, 6, 6, paint);
            canvas.drawRoundRect(cx + size * 0.10f, cy + size * 0.27f,
                    cx + size * 0.20f, cy + size * 0.47f, 6, 6, paint);

            // Тело и голова.
            color(Color.rgb(255, 252, 230));
            canvas.drawOval(cx - size * 0.4f, cy - size * 0.27f,
                    cx + size * 0.4f, cy + size * 0.35f, paint);
            canvas.drawCircle(cx + size * 0.17f, cy - size * 0.23f,
                    size * 0.22f, paint);

            // Крыло.
            color(Color.rgb(235, 228, 200));
            canvas.drawOval(cx - size * 0.27f, cy - size * 0.02f,
                    cx + size * 0.08f, cy + size * 0.21f, paint);

            // Гребешок.
            color(Color.rgb(222, 62, 52));
            canvas.drawCircle(cx + size * 0.10f, cy - size * 0.43f,
                    size * 0.07f, paint);
            canvas.drawCircle(cx + size * 0.20f, cy - size * 0.44f,
                    size * 0.07f, paint);

            // Клюв.
            color(Color.rgb(244, 159, 40));
            Path beak = new Path();
            beak.moveTo(cx + size * 0.35f, cy - size * 0.25f);
            beak.lineTo(cx + size * 0.49f, cy - size * 0.19f);
            beak.lineTo(cx + size * 0.35f, cy - size * 0.13f);
            beak.close();
            canvas.drawPath(beak, paint);

            color(Color.rgb(35, 35, 35));
            canvas.drawCircle(cx + size * 0.24f, cy - size * 0.27f,
                    size * 0.025f, paint);
        }

        @Override
        public boolean onTouchEvent(MotionEvent event) {
            if (event.getActionMasked() == MotionEvent.ACTION_DOWN) {
                float w = getWidth();
                float h = getHeight();
                float size = Math.min(w, h) * 0.32f;
                float cx = w / 2f;
                float ground = h * 0.78f;
                float lift = 0;

                if (jumpStarted >= 0) {
                    float t = (SystemClock.uptimeMillis() - jumpStarted)
                            / (float) JUMP_MS;
                    if (t < 1f) {
                        lift = (float) Math.sin(Math.PI * t) * size * 0.8f;
                    }
                }

                float cy = ground - size * 0.45f - lift;
                boolean hit = Math.abs(event.getX() - cx) <= size * 0.55f
                        && Math.abs(event.getY() - cy) <= size * 0.55f;

                if (hit && (jumpStarted < 0
                        || SystemClock.uptimeMillis() - jumpStarted >= JUMP_MS)) {
                    jumpStarted = SystemClock.uptimeMillis();
                    jumps++;
                    performClick();
                    invalidate();
                }
                return true;
            }
            return super.onTouchEvent(event);
        }

        @Override
        public boolean performClick() {
            super.performClick();
            return true;
        }
    }
}
