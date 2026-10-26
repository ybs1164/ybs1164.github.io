# 결 AI 대국

`/gyeol/play/`에서 실행되는 기본 AI 대국입니다. 상대 타일을 돌리고 인접한 빈칸을 고르면, 새 타일은 방금 돌린 상대 타일을 바라보도록 놓입니다. 새 타일의 방향을 따로 선택하지 않습니다. 번갈아 플레이(`/gyeol/local/`)도 같은 규칙을 사용합니다.

규칙과 785개 행동 인코딩은 `../facing/engine.js`, ONNX 추론과 전용 학습 모델은 `../facing/worker.js`와 `../facing/model.onnx`를 공유합니다. 이 폴더의 `engine.js`와 `worker.js`는 해당 구현을 불러옵니다. 모델 갱신 경로는 [모델 안내](../facing/README.md)를 참고하세요. 자유 방향 규칙의 엔진과 모델은 삭제했습니다.

AlphaZero MCTS는 50회(cpuct 1.5)로 고정합니다. 별도 Python 서버 없이 Web Worker에서 ONNX Runtime Web 1.24.3으로 추론합니다. 실행 라이브러리는 `vendor/`에 포함되어 있으며 라이선스는 `vendor/LICENSE`에 있습니다. HTTP 서버는 `.mjs`를 `application/javascript`로 제공해야 합니다.

판 왼쪽 평가 바는 합법 수의 정책 확률을 따라 12회 가상 대국을 끝까지 진행한 뒤 최종 `초록 수 − 갈색 수`의 평균을 표시합니다. 동일한 국면과 차례에는 같은 난수 시드를 사용합니다. 숫자는 소수 첫째 자리까지 표시하며 바 길이는 `0.5 + atan(타일 차이 / 5) / π`로 조정합니다. 종료 시에는 실제 타일 차이를 표시합니다.

검증: 저장소 루트에서 `node --test gyeol/play/engine.test.mjs gyeol/local/rules.test.mjs`.
