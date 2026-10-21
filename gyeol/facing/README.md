# 마주보기 규칙 AI

`/gyeol/facing/`에서 전용 학습 모델과 대국합니다. 상대 타일과 회전 방향을 고른 뒤 빈 칸을 누르면, 새 타일이 돌린 타일을 향하도록 자동으로 놓입니다. 선공·후공 선택, 패스, 새 게임, 예상 타일 차이를 지원합니다.

규칙과 MCTS는 `engine.js`, ONNX 추론은 `worker.js`에 있습니다. 실행 라이브러리는 `../play/vendor/`를 공유하며 모델은 이 폴더의 `model.onnx`를 사용합니다. HTTP 서버로 제공해야 합니다.

학습 프로젝트에서 모델 갱신:

```powershell
python publish_facing_model.py
python publish_facing_model.py --checkpoint facing/temp/checkpoint_3.pth.tar
python test_facing_web.py
```

스크립트는 PyTorch와 ONNX의 추론 결과를 비교한 뒤 모델·메타데이터·모델 캐시 버전을 갱신합니다. 기본 대상은 `N:/Projects/ybs1164.github.io`이며 `--repo`로 변경할 수 있습니다.

첫 공개 시 이 페이지와 소개 페이지의 링크를 포함해 커밋·배포하세요. 이후 변경 사항이 없는 저장소에서 `python publish_facing_model.py --push`를 실행하면 새 모델을 적용하고 모델 관련 세 파일만 커밋·푸시합니다. 기본 실행은 커밋이나 푸시를 하지 않습니다. 로컬 적용을 먼저 했다면 해당 변경 사항을 직접 커밋한 뒤 푸시하세요.
