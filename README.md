#  Hand Rehabilitation Training Platform

Một dự án ứng dụng Computer Vision cho **phục hồi chức năng bàn tay**, sử dụng:
- [MediaPipe](https://mediapipe.dev) để nhận diện bàn tay và cử chỉ.
- [FastAPI](https://fastapi.tiangolo.com/) để truyền dữ liệu thời gian thực qua WebSocket.
- [Three.js](https://threejs.org/) để dựng mô hình bàn tay 3D realtime.
- Giao diện Web thân thiện, điều khiển hoàn toàn **bằng cử động tay**, **không cần chuột hay bàn phím**.

Mục tiêu:  
 **Hỗ trợ các bài tập phục hồi chức năng tay** cho bệnh nhân sau chấn thương, tai biến, hoặc phục hồi vận động.

---

##  Cấu trúc thư mục

```plaintext
hand_rehab_project/
├── hand_gesture.py           # Python backend: MediaPipe + FastAPI server
├── gesture_recognizer.task    # Model nhận diện cử chỉ tay
│
├── index.html                 # Trang chủ: chọn bài tập
├── exercise.html              # Trang bài tập phục hồi chức năng
│
├── app.js                     # JavaScript cho trang chủ
├── exercise.js                # JavaScript cho trang bài tập
├── common-ui.js               # Module xử lý hover, dwell-click, hand pointer
│
├── styles.css                 # CSS giao diện
├── three.min.js               # Thư viện Three.js
└── README.md                  # Tài liệu hướng dẫn (file này)
