# 🖐️ Hand Tracking Web Control

Một dự án demo điều khiển giao diện web bằng **tay thật**, sử dụng:
- [MediaPipe](https://mediapipe.dev) để nhận diện landmark tay
- [FastAPI](https://fastapi.tiangolo.com/) để truyền dữ liệu realtime qua WebSocket
- [Three.js](https://threejs.org/) để vẽ mô hình bàn tay 3D
- Điều khiển giao diện bằng **hover + dwell-click** (giữ tay 1 giây để bấm).

---

## 🗂️ Cấu trúc thư mục

```plaintext
hand_gesture_project/
├── hand_gesture.py           # Python backend: MediaPipe + FastAPI server
├── gesture_recognizer.task    # Model nhận diện cử chỉ tay (MediaPipe)
│
├── index.html                 # Trang chủ: chỉ có con trỏ
├── exercise.html              # Trang bài tập: vẽ tay 3D và làm bài tập
│
├── app.js                     # JavaScript cho index.html
├── exercise.js                # JavaScript cho exercise.html
├── common-ui.js               # Module chung xử lý hover, dwell-click
│
├── styles.css                 # CSS giao diện
├── three.min.js               # Thư viện Three.js
└── README.md                  # Tài liệu hướng dẫn (file này)
