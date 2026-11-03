# HTML 자료실

HTML 제작은 `pages/`에 파일을 저장하는 작업이고, 게시는 `publish.ps1`을 실행하는 별도 작업입니다. Node, npm, Python, 외부 CDN은 필요 없습니다.

- 자료실: https://jinhoofkepco.github.io/html-library/
- 저장소: https://github.com/jinhoofkepco/html-library

## Windows 11에서 사용

최초 한 번 Git for Windows로 저장소를 복제하고 GitHub 인증을 완료합니다. Git 사용자 이름과 이메일도 설정되어 있어야 합니다. Windows 기본 PowerShell 5.1 이상을 사용합니다.

```powershell
git clone https://github.com/jinhoofkepco/html-library.git
cd html-library
```

이후 HTML 파일 수십 개를 한꺼번에 `pages/`에 복사하고 저장소 폴더에서 실행합니다.

```powershell
.\publish.ps1
```

실행 정책이 스크립트를 차단하는 PC에서는 전역 정책을 바꾸지 않고 다음 한 명령을 사용합니다.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\publish.ps1
```

목록 갱신, `pages/`와 생성된 `index.html` 커밋, 원격 push를 순서대로 수행한 뒤 개별 HTML URL을 출력합니다. GitHub Actions 배포는 push 후 별도로 진행되므로 출력 URL은 배포 완료 후 열립니다. 실제 배포 상태는 저장소 Actions에서 확인합니다. 실행 위치와 무관하게 스크립트가 있는 저장소를 사용합니다.

## 파일과 링크

- `pages/report.html` → `<자료실 URL>/pages/report.html`
- `pages/수학/분수 연습.html`도 지원하며 URL은 자동 인코딩합니다.
- 하위 폴더의 `.html`, `.htm` 파일도 모두 목록에 포함합니다.
- 파일명과 폴더 경로로 대소문자 구분 없이 검색합니다. 검색은 서버 없이 브라우저에서 실행됩니다.
- 기존 파일을 이동하거나 삭제하지 않습니다. 스크립트는 추적 중인 파일 삭제를 발견하면 중단합니다. 같은 이름의 파일을 직접 덮어쓰면 해당 내용은 바뀌므로 새 자료는 새 이름을 사용합니다.
- HTML이 사용하는 이미지·CSS·JavaScript는 `pages/`에 함께 넣고 상대 경로로 연결합니다. 단일 HTML뿐 아니라 관련 파일도 같이 게시됩니다.
- `publish.ps1`은 다른 파일의 변경을 자동 커밋하지 않습니다. 이미 stage된 변경이 있으면 중단합니다. push 충돌은 덮어쓰거나 force push하지 않고 그대로 오류를 알립니다.

## 구성

- `update-index.ps1`: HTML 목록 생성. 목록만 갱신하려면 이 스크립트만 실행합니다.
- `index.template.html`: 자료실 화면과 파일명 검색. 외부 라이브러리가 없습니다.
- `index.html`: 자동 생성된 링크 목록. 직접 수정하지 않습니다.
- `publish.ps1`: 목록 생성 → commit → push → URL 출력.
- `publish.config.json`: 실제 Pages URL과 게시 브랜치.
- `.github/workflows/pages.yml`: main push 시 목록을 다시 생성하고 GitHub Pages에 배포. 공개 파일은 `index.html`과 `pages/`만 배포합니다.

## 최초 설정

이 저장소는 최초 설정에서 GitHub Pages의 배포 원본을 GitHub Actions로 지정했습니다. `publish.config.json`에 실제 주소가 저장되어 있습니다. 브랜치를 바꾸면 `publish.config.json`과 workflow의 branches를 함께 수정합니다.

기존 저장소를 연결할 때 원본 경로와 배포 주소를 먼저 확인합니다. 기존 루트 `index.html`을 임의로 덮어쓰지 않도록 목록 생성기가 중단합니다. 기존 사이트 파일을 일괄 이동하면 이전 URL이 바뀌므로 그런 이동은 하지 않습니다.

GitHub Pages에 게시한 자료는 웹에 공개됩니다. 비밀 정보나 비공개 자료를 넣지 마세요.

## 개발 검증

`tests/smoke.ps1`은 임시 로컬 Git 저장소만 사용하여 51개 HTML 일괄 게시, 한글·공백·기호 파일명, 추가 게시 시 기존 내용 유지, 변경 없는 재실행, commit/push, 삭제 방지, 다른 변경의 잘못된 커밋 방지를 확인합니다. 실제 GitHub로 push하지 않습니다.

```powershell
.\tests\smoke.ps1
```

GitHub 공식 안내: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
