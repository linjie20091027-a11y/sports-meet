<p align="center">
  <img src="https://img.shields.io/badge/濠江中學-運動會管理系統-A80000?style=for-the-badge">
</p>

<h1 align="center">🏅 運動會管理系統</h1>
<h3 align="center">澳門濠江中學 · 第三十屆田徑運動會</h3>

<p align="center">
  <img src="https://img.shields.io/badge/前端-HTML%2FCSS%2FJS-blue">
  <img src="https://img.shields.io/badge/後端-Node.js%20%2B%20Express-green">
  <img src="https://img.shields.io/badge/數據庫-SQLite-lightgrey">
</p>

---

> *「體育之道，貴乎自強。」—— 強健體魄，磨礪意志，賽場之上見真章。*

## 🌟 簡介

這是一套專為**中小學運動會**打造的全流程管理系統。從賽事發布、在線報名、賽程編排，到成績錄入、自動排名、數據公示——讓繁瑣的籌備工作變得井井有條。

以**澳門濠江中學**第三十屆田徑運動會為藍本，採用紅牆白瓦的端莊風格，典雅之中不失青春的躍動。

## ✨ 核心功能

| 模塊 | 功能 |
|------|------|
| 🏠 **首頁大屏** | 開幕倒計時、賽事總覽、最新公告、成績公示 |
| 🏃 **賽事項目** | 短跑、長跑、跳躍、投擲、接力、集體項目 |
| 📝 **在線報名** | 一鍵報名、名額限制、重複檢測、審核流程 |
| 📅 **賽程編排** | 自動編排、手動調整、衝突檢測、一鍵發布 |
| 🏆 **成績管理** | 成績錄入、自動排名、獎項匹配、批量導入 |
| 📊 **數據統計** | 班級排名、可視化圖表、Excel/CSV導出 |
| 📢 **公告通知** | 分類公告、置頂功能、站內通知推送 |
| 👤 **用戶管理** | 批量導入、角色權限、自定義頭像 |
| 🔒 **安全機制** | 驗證碼登錄、JWT認證、密碼加密 |

## 🚀 快速開始

```bash
# 克隆倉庫
git clone https://github.com/linjie20091027-a11y/sports-meet.git
cd sports-meet

# 安裝依賴
npm install

# 啟動服務
node server.js
```

訪問 `http://localhost:3000`

### 默認賬號

| 角色 | 郵箱 | 密碼 |
|------|------|------|
| 管理員 | `admin@hkms.hktedu.com` | `admin123` |
| 管理員 | `2100@hkms.hktedu.com` | `admin123` |
| 管理員 | `0037@hkms.hktedu.com` | `admin123` |
| 學生 | `20250001@hkms.hktedu.com` | `123456` |

## 📂 項目結構

```
sports-meet/
├── server.js              # 服務入口
├── database/init.js       # SQLite 初始化
├── middleware/auth.js     # JWT 認證
├── routes/                # API 路由
│   ├── auth.js            # 登錄/註冊
│   ├── public.js          # 公共API
│   ├── admin.js           # 管理員API
│   └── student.js         # 學生API
└── public/                # 前端
    ├── index.html
    ├── css/style.css
    └── js/
        ├── api.js
        ├── app.js
        ├── auth.js
        ├── admin.js
        └── student.js
```

## 🤝 協作

```bash
git pull                    # 拉取最新
git checkout -b feature/xxx # 新建分支
git add .                   # 添加改動
git commit -m "✨ 新增功能"  # 提交
git push                    # 推送
```

---

<p align="center">
  <sub>澳門濠江中學 · 第三十屆田徑運動會 · 2026</sub>
</p>
