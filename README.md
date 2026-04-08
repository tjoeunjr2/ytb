# YT.PLAY — 광고 없는 YouTube 플레이어

yt-dlp로 직접 스트림 URL을 추출해서 광고 없이 재생합니다.

## 설치

```bash
# 의존성 설치
pip install -r requirements.txt
```

## 실행

```bash
python server.py
```

그 다음 브라우저에서 http://localhost:5000 열기

## 사용법

1. YouTube URL 붙여넣기 (youtube.com/watch?v=... 또는 youtu.be/...)
2. 엔터 또는 [+ 추가] 버튼 클릭
3. 자동으로 재생목록에 추가 & 재생 시작

## 기능

- 광고 완전 차단 (yt-dlp로 직접 스트림 URL 추출)
- 자동재생 ON/OFF
- 반복 재생 ON/OFF
- 재생목록 관리 (추가/삭제/순서 클릭)
- 이전/다음 트랙

## 주의사항

- yt-dlp는 주기적으로 업데이트가 필요합니다: `pip install -U yt-dlp`
- 비공개 영상이나 지역 제한 영상은 재생 안 될 수 있습니다
- 스트림 URL은 약 6시간 후 만료됩니다 (다시 추가하면 됩니다)
