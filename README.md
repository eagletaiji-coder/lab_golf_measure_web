# LieLine — 퍼터 라이각 측정

바닥이 수평이라고 가정하고, 스마트폰 카메라로 퍼터 **라이각(lie angle)** 을 측정하는 웹 앱입니다.

## 웹 서버에 올려서 테스트

정적 호스팅이면 됩니다. **HTTPS** 가 필요합니다 (카메라·모션).

### 업로드할 파일/폴더

```
index.html
.htaccess          (Apache)
web.config         (IIS, 해당 시)
src/
  main.js
  styles.css
  shaftDetect.js
```

`serve.py`, `package.json`, `README.md` 는 올리지 않아도 됩니다.

### 확인

1. `https://your-domain/.../index.html` 접속
2. 폰에서는 **같은 Wi‑Fi localhost가 아니라** 그 HTTPS 주소로 접속
3. Safari/Chrome에서 카메라 권한 허용 후 **측정 시작**

JS가 안 먹으면 호스팅 MIME에서 `.js` → `text/javascript` (또는 `application/javascript`) 인지 확인하세요.


## 사용 방법

1. **측정 시작** → 카메라/모션 권한 허용
2. 퍼터를 평평한 바닥에 솔이 닿게 둡니다
3. 기기를 좌우 수평으로 맞춥니다
4. **자동 인식**이 샤프트 양면 엣지를 추적하고 각도의 평균으로 라이각을 냅니다 (실패 시 노란 라인을 드래그)
5. 필요 시 **화면 고정** 후 미세 조정, **결과 저장**으로 이미지 다운로드
