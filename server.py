#!/usr/bin/env python3
"""
YouTube Ad-Free Player Server
Uses yt-dlp to fetch direct stream URLs, bypassing ads entirely.
"""

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import yt_dlp
import re
import os

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)


def extract_video_id(url):
    patterns = [
        r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([A-Za-z0-9_-]{11})',
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    return None


@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


@app.route('/api/resolve', methods=['POST'])
def resolve():
    data = request.get_json()
    url = data.get('url', '').strip()

    if not url:
        return jsonify({'error': 'URL이 비어있습니다'}), 400

    vid = extract_video_id(url)
    if not vid:
        return jsonify({'error': '유효한 YouTube URL이 아닙니다'}), 400

    canonical = f'https://www.youtube.com/watch?v={vid}'

    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
        'format': 'bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        'noplaylist': True,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(canonical, download=False)

        # Get the best stream URL
        stream_url = None
        if 'url' in info:
            stream_url = info['url']
        elif 'formats' in info:
            # prefer progressive mp4 (video+audio combined)
            for fmt in reversed(info['formats']):
                if (fmt.get('ext') == 'mp4'
                        and fmt.get('url')
                        and fmt.get('acodec') != 'none'
                        and fmt.get('vcodec') != 'none'):
                    stream_url = fmt['url']
                    break
            if not stream_url:
                for fmt in reversed(info['formats']):
                    if fmt.get('url'):
                        stream_url = fmt['url']
                        break

        if not stream_url:
            return jsonify({'error': '스트림 URL을 가져올 수 없습니다'}), 500

        thumbnail = info.get('thumbnail', '')
        thumbnails = info.get('thumbnails', [])
        for t in thumbnails:
            if t.get('id') == 'mqdefault' or '320' in str(t.get('width', '')):
                thumbnail = t['url']
                break

        return jsonify({
            'id':         vid,
            'title':      info.get('title', '제목 없음'),
            'channel':    info.get('uploader', '알 수 없음'),
            'duration':   info.get('duration', 0),
            'thumbnail':  thumbnail,
            'stream_url': stream_url,
        })

    except yt_dlp.utils.DownloadError as e:
        msg = str(e)
        if 'Private video' in msg:
            return jsonify({'error': '비공개 영상입니다'}), 403
        if 'Video unavailable' in msg:
            return jsonify({'error': '재생할 수 없는 영상입니다'}), 404
        return jsonify({'error': f'영상을 가져오지 못했습니다: {msg[:120]}'}), 500
    except Exception as e:
        return jsonify({'error': str(e)[:200]}), 500


if __name__ == '__main__':
    print("=" * 50)
    print("  YouTube Ad-Free Player")
    print("  http://localhost:5000 에서 실행 중")
    print("=" * 50)
    app.run(host='0.0.0.0', port=5000, debug=False)
