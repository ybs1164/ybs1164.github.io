# 결 AI 대국

`/gyeol/play/`에서 실행되는 정적 웹 게임입니다. 원본 `gyeol_ai/web/index.html`의 조작과 게임 규칙을 유지하며, 모바일에서는 타일을 조금 더 크게 표시합니다. AlphaZero MCTS는 50회(cpuct 1.5)로 고정합니다. 별도 Python 서버 없이 Web Worker에서 ONNX Runtime Web 1.24.3으로 추론합니다.

`model.onnx`는 2026-10-16의 `gyeol_ai/temp/best.pth.tar`를 ONNX opset 17로 변환한 모델입니다. 원본 체크포인트의 SHA-256은 `model-info.json`에 기록했습니다. 이후 학습 결과는 자동 반영되지 않으며 모델을 다시 내보내야 합니다.

런타임과 모델을 모두 이 폴더에 포함했으므로 외부 CDN은 필요하지 않습니다. 런타임 라이선스는 `vendor/LICENSE`에 있습니다. HTTP 서버는 `.mjs`를 `application/javascript`로 제공해야 합니다. Windows의 Python 기본 HTTP 서버는 시스템 MIME 설정에 따라 `.mjs`를 `text/plain`으로 제공할 수 있습니다.

검증: Python과 JavaScript의 합법 수·보드·뒤집기 좌표·종료 결과 367개 사례 일치. ONNX와 PyTorch 추론 최대 절대 오차 약 0.0000013.
