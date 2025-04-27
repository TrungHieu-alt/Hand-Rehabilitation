import cv2
import mediapipe as mp
import numpy as np
import time
import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import uvicorn, asyncio, json
from threading import Thread
EVENT_LOOP = None        
app = FastAPI()
clients:set[WebSocket] = set()
LOG_F = open("landmarks.jsonl", "a", encoding="utf-8")

FINGER_JOINT = {
    0: ("wrist", "WRIST"),

    1: ("thumb",  "CMC"),  2: ("thumb",  "MCP"),
    3: ("thumb",  "IP"),   4: ("thumb",  "TIP"),

    5: ("index",  "MCP"),  6: ("index",  "PIP"),
    7: ("index",  "DIP"),  8: ("index",  "TIP"),

    9: ("middle", "MCP"), 10: ("middle", "PIP"),
   11: ("middle", "DIP"), 12: ("middle", "TIP"),

   13: ("ring",   "MCP"), 14: ("ring",   "PIP"),
   15: ("ring",   "DIP"), 16: ("ring",   "TIP"),

   17: ("pinky",  "MCP"), 18: ("pinky",  "PIP"),
   19: ("pinky",  "DIP"), 20: ("pinky",  "TIP"),
}

def structure_landmarks(mp_landmarks):
    """
    Nhận list 21 landmark của MediaPipe → trả dict ngón tay.
    """
    fingers = {f: [] for f in ("wrist","thumb","index","middle","ring","pinky")}
    for idx, lm in enumerate(mp_landmarks):
        finger, joint = FINGER_JOINT[idx]
        fingers[finger].append({
            "joint": joint,
            "x": lm.x, "y": lm.y, "z": lm.z
        })
    return fingers


async def broadcast(message: dict):
    """
    Gửi cùng một JSON 'message' tới mọi WebSocket client còn sống.
    """
    dead = []
    for ws in clients:
        try:
            await ws.send_json(message)
        except WebSocketDisconnect:
            dead.append(ws)
    for ws in dead:   # remove client đã rớt
        clients.remove(ws)


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    clients.add(ws)
    try:
        # Chúng ta KHÔNG lấy dữ liệu từ client, nhưng vẫn phải await để giữ kết nối
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        clients.discard(ws)


# Thiết lập logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Khởi tạo các lớp từ MediaPipe
BaseOptions = mp.tasks.BaseOptions
GestureRecognizer = mp.tasks.vision.GestureRecognizer
GestureRecognizerOptions = mp.tasks.vision.GestureRecognizerOptions
GestureRecognizerResult = mp.tasks.vision.GestureRecognizerResult
VisionRunningMode = mp.tasks.vision.RunningMode

# Biến lưu trạng thái trước đó
last_gesture = None
last_finger_count = -1
last_landmarks = None          # NEW – lưu 21 điểm khung hình trước


# Ánh xạ cử chỉ với số ngón tay
GESTURE_FINGER_MAP = {
    "None": 0,
    "Open_Palm": 5,
    "Closed_Fist": 0,
    "Pointing_Up": 1,
    "Thumb_Up": 1,
    "Victory": 2,
    "ILoveYou": 3,
    "Okay": 3,
    "Live_Long": 2,
    "Thumb_Down": 1,
    "One": 1,
    "Two": 2,
    "Three": 3,
    "Four": 4,
    "Five": 5
}

# Hàm tính khoảng cách Euclidean giữa hai điểm
def calculate_distance(point1, point2):
    try:
        return np.sqrt(np.sum((np.array(point1) - np.array(point2)) ** 2))
    except Exception as e:
        logging.error(f"Error in calculate_distance: {str(e)}")
        return 0

# Hàm dự phòng đếm số ngón tay (3 hoặc 4)
# ===== THAY HẾT NỘI DUNG hàm count_fingers_fallback bằng đoạn mới này =====
import math

def calculate_angle(a, b, c):
    """
    Trả về góc (độ) tại điểm b của tam giác a-b-c.
    """
    try:
        ab = np.array(a) - np.array(b)
        cb = np.array(c) - np.array(b)
        cos_angle = np.dot(ab, cb) / (np.linalg.norm(ab) * np.linalg.norm(cb) + 1e-6)
        return np.degrees(np.arccos(np.clip(cos_angle, -1.0, 1.0)))
    except Exception as e:
        logging.error(f"Error in calculate_angle: {str(e)}")
        return 0.0

def landmarks_changed(prev, curr, tol=1e-4):
    """
    Trả True nếu danh sách 21 landmark 'curr' khác 'prev' quá ngưỡng 'tol'.
    So sánh tuyệt đối trên x,y,z.
    """
    if prev is None or len(prev) != 21 or len(curr) != 21:
        return True
    for (a, b) in zip(prev, curr):
        if abs(a["x"]-b["x"]) > tol or abs(a["y"]-b["y"]) > tol or abs(a["z"]-b["z"]) > tol:
            return True
    return False


def count_fingers_fallback(landmarks):
    """
    Xác định xem có 3 hay 4 ngón (trỏ-giữa-nhẫn-út) đang duỗi bằng
    - Góc tại khớp PIP   ( > 160°  → duỗi )
    - Khoảng cách TIP-MCP ( > 0.28 * hand_size → duỗi )

    Trả về tuple (tên_gesture, số_ngón_duỗi).
    """
    try:
        # ==== 1. Các chỉ số landmark cho 4 ngón cần xét ====
        finger_defs = {
            "Index":  (5, 6, 7, 8),
            "Middle": (9, 10, 11, 12),
            "Ring":   (13, 14, 15, 16),
            "Pinky":  (17, 18, 19, 20),
        }

        # ==== 2. Chuẩn hoá kích cỡ bàn tay ====
        wrist      = np.array([landmarks[0].x, landmarks[0].y, landmarks[0].z])
        middle_mcp = np.array([landmarks[9].x, landmarks[9].y, landmarks[9].z])
        hand_size  = np.linalg.norm(wrist - middle_mcp) + 1e-6   # +ε chống chia 0

        finger_states = []
        for name, (mcp_idx, pip_idx, dip_idx, tip_idx) in finger_defs.items():
            mcp = np.array([landmarks[mcp_idx].x, landmarks[mcp_idx].y, landmarks[mcp_idx].z])
            pip = np.array([landmarks[pip_idx].x, landmarks[pip_idx].y, landmarks[pip_idx].z])
            dip = np.array([landmarks[dip_idx].x, landmarks[dip_idx].y, landmarks[dip_idx].z])
            tip = np.array([landmarks[tip_idx].x, landmarks[tip_idx].y, landmarks[tip_idx].z])

            # ---- Tiêu chí 1: góc tại khớp PIP ----
            angle_pip = calculate_angle(mcp, pip, dip)

            # ---- Tiêu chí 2: khoảng cách TIP-MCP đã chuẩn hoá ----
            tip_mcp_norm = np.linalg.norm(tip - mcp) / hand_size

            # ---- Quyết định ----
            is_extended = (angle_pip > 160.0) and (tip_mcp_norm > 0.28)
            finger_states.append((name, is_extended, angle_pip, tip_mcp_norm))

        # ==== 3. Thống kê & kết luận ====
        extended_count = sum(1 for _, e, _, _ in finger_states if e)

        # Log chi tiết để tiện chỉnh ngưỡng nếu cần
        debug_msg = ", ".join(
            f"{n}:{'↑' if e else '↓'}(θ={a:.1f},d={d:.2f})" for n, e, a, d in finger_states
        )
        logging.debug(f"[Fallback] {debug_msg}  ⇒  extended={extended_count}")

        if extended_count == 3:
            return "Three", 3
        if extended_count == 4:
            return "Four", 4
        return "None", 0

    except Exception as e:
        logging.error(f"Error in count_fingers_fallback: {str(e)}")
        return "None", 0


# Hàm lấy số ngón tay từ cử chỉ
def get_finger_count(gesture):
    return GESTURE_FINGER_MAP.get(gesture, 0)  # Mặc định 0 nếu cử chỉ không xác định

def print_result(result: GestureRecognizerResult,
                 output_image: mp.Image,
                 timestamp_ms: int):
    """
    Callback của MediaPipe.
    Thay vì print(), ta đóng gói JSON rồi broadcast qua WS.
    Chỉ gửi khi gesture hoặc fingerCount thay đổi.
    """
    global last_gesture, last_finger_count, last_landmarks

    try:
        # --- Phân tích gesture như code cũ ---
        current_gesture = "None"
        gesture_confidence = 0.0
        if result.gestures and result.gestures[0]:
            g = result.gestures[0][0]
            current_gesture = g.category_name
            gesture_confidence = g.score

        handedness = "Unknown"
        handedness_confidence = 0.0
        if result.handedness and result.handedness[0]:
            h = result.handedness[0][0]
            handedness = h.category_name
            handedness_confidence = h.score

        # fallback cho Three/Four
        if current_gesture == "None" and result.hand_landmarks and result.hand_landmarks[0]:
            fb_gesture, fb_cnt = count_fingers_fallback(result.hand_landmarks[0])
            if fb_gesture != "None":
                current_gesture = fb_gesture
                finger_count = fb_cnt
                gesture_confidence = 0.7
            else:
                finger_count = get_finger_count(current_gesture)
        else:
            finger_count = get_finger_count(current_gesture)

                # --- Chuẩn bị danh sách landmark hiện tại ---
        curr_landmarks = [
            {"x": lm.x, "y": lm.y, "z": lm.z}
            for lm in (result.hand_landmarks[0] if result.hand_landmarks else [])
        ]

        # --- Kiểm tra thay đổi ---
        gest_changed   = current_gesture != last_gesture
        finger_changed = finger_count   != last_finger_count
        lmk_changed    = landmarks_changed(last_landmarks, curr_landmarks)

        if gest_changed or finger_changed or lmk_changed:
            payload = {
                "gesture": current_gesture,
                "fingerCount": finger_count,
                "gestureConfidence": round(gesture_confidence, 2),
                "handedness": handedness,
                "handednessConf": round(handedness_confidence, 2),
                "landmarks": curr_landmarks
            }
            if EVENT_LOOP:
                asyncio.run_coroutine_threadsafe(broadcast(payload), EVENT_LOOP)

            # --- cập nhật trạng thái ---
            last_gesture      = current_gesture
            last_finger_count = finger_count
            last_landmarks    = curr_landmarks

            # if result.hand_landmarks and result.hand_landmarks[0]:
            #     hand_dict = {
            #         "ts"        : timestamp_ms,
            #         "hand"      : handedness,          # Left / Right
            #         "gesture"   : current_gesture,
            #         "fingerCount": finger_count,
            #     }
            #     hand_dict.update( structure_landmarks(result.hand_landmarks[0]) )
            #     line = json.dumps(hand_dict, ensure_ascii=False)
            #     print(line)             # thấy ngay trên terminal
            #     LOG_F.write(line + "\n")# ghi xuống file
            #     LOG_F.flush()           # đảm bảo xả đệm
            
    except Exception as e:
        logging.error(f"Error in print_result: {str(e)}")


# Cấu hình Gesture Recognizer
model_path ='gesture_recognizer.task'  # Thay bằng đường dẫn thực tế
options = GestureRecognizerOptions(
    base_options=BaseOptions(model_asset_path=model_path),
    running_mode=VisionRunningMode.LIVE_STREAM,
    num_hands=1,
    min_hand_detection_confidence=0.5,
    min_hand_presence_confidence=0.5,
    min_tracking_confidence=0.5,
    result_callback=print_result
)

# # Khởi tạo recognizer
# try:
#     with GestureRecognizer.create_from_options(options) as recognizer:
#         # Thử các index webcam
#         for index in range(3):
#             cap = cv2.VideoCapture(index)
#             if cap.isOpened():
#                 logging.info(f"Webcam opened successfully with index {index}")
#                 break
#         else:
#             logging.error("Error: Cannot open any webcam")
#             exit()

#         # Kiểm tra kích thước frame
#         frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
#         frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
#         logging.info(f"Webcam frame size: {frame_width}x{frame_height}")

#         # Biến lưu thời gian
#         frame_timestamp_ms = 0

#         try:
#             while cap.isOpened():
#                 ret, frame = cap.read()
#                 if not ret:
#                     logging.error("Error: Cannot read frame from webcam")
#                     break

#                 # Chuyển frame sang RGB và tạo mp.Image
#                 try:
#                     frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
#                     mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
#                 except Exception as e:
#                     logging.error(f"Error processing frame: {str(e)}")
#                     continue

#                 # Gửi frame để nhận diện
#                 try:
#                     recognizer.recognize_async(mp_image, frame_timestamp_ms)
#                     frame_timestamp_ms += 33  # ~30 FPS
#                 except Exception as e:
#                     logging.error(f"Error in recognize_async: {str(e)}")
#                     continue

#                 # Hiển thị frame
#                 cv2.imshow('Webcam', frame)
#                 if cv2.waitKey(1) & 0xFF == ord('q'):
#                     logging.info("User pressed 'q' to exit")
#                     break

#                 time.sleep(0.01)

#         except Exception as e:
#             logging.error(f"Error in main loop: {str(e)}")
#         finally:
#             cap.release()
#             cv2.destroyAllWindows()
#             logging.info("Webcam released and windows closed")

# except Exception as e:
#     logging.error(f"Error initializing recognizer: {str(e)}")

def run_hand_tracking():
    """Mở webcam + MediaPipe, gửi WS khi có cử chỉ mới."""
    global last_gesture, last_finger_count

    model_path = "gesture_recognizer.task"
    options = GestureRecognizerOptions(
        base_options=BaseOptions(model_asset_path=model_path),
        running_mode=VisionRunningMode.LIVE_STREAM,
        num_hands=1,
        min_hand_detection_confidence=0.5,
        min_hand_presence_confidence=0.5,
        min_tracking_confidence=0.5,
        result_callback=print_result
    )

    with GestureRecognizer.create_from_options(options) as recognizer:
        # tìm webcam
        cap = next((cv2.VideoCapture(i) for i in range(3) if cv2.VideoCapture(i).isOpened()), None)
        if not cap:
            logging.error("Cannot open any webcam"); return
        logging.info("Webcam opened")

        ts_ms = 0
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret: break
            mp_img = mp.Image(image_format=mp.ImageFormat.SRGB,
                              data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            recognizer.recognize_async(mp_img, ts_ms); ts_ms += 33
            cv2.imshow("Webcam", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'): break
        cap.release(); cv2.destroyAllWindows()


def start_fastapi():
    """
    Khởi chạy Uvicorn + lấy event loop để thread khác dùng.
    """
    global EVENT_LOOP
    import uvicorn

    # Tạo loop riêng cho server
    EVENT_LOOP = asyncio.new_event_loop()
    asyncio.set_event_loop(EVENT_LOOP)

    config = uvicorn.Config(app, host="0.0.0.0", port=8000,
                            log_level="error", loop="asyncio")
    server = uvicorn.Server(config)
    EVENT_LOOP.run_until_complete(server.serve())
if __name__ == "__main__":
    # 1. bật FastAPI ở thread riêng
    Thread(target=start_fastapi, daemon=True).start()
    time.sleep(1)                # đợi server thật sự lắng nghe
    print(">>> FastAPI ready, start hand-tracking")

    # 2. chạy hand-tracking (thread chính)
    run_hand_tracking()

