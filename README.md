<p align="center">
  <img src="https://img.shields.io/badge/濠江中學-運動會管理系統-A80000?style=for-the-badge" alt="濠江中學運動會管理系統">
</p>

<h1 align="center">🏅 運動會管理系統</h1>
<h3 align="center">澳門濠江中學 · 第三十屆田徑運動會</h3>

<p align="center">
  <img src="https://img.shields.io/badge/前端-HTML%2FCSS%2FJS-blue" alt="frontend">
  <img src="https://img.shields.io/badge/後端-Node.js%20%2B%20Express-green" alt="backend">
  <img src="https://img.shields.io/badge/數據庫-SQLite-lightgrey" alt="database">
  <img src="https://img.shields.io/badge/license-MIT-brightgreen" alt="license">
</p>

---

> *「體育之道，貴乎自強。」—— 強健體魄，磨礪意志，賽場之上見真章。*

## 🌟 項目簡介

這是一套專為**中小學運動會**打造的全流程管理系統。從賽事發布、在線報名、賽程編排，到成績錄入、自動排名、數據公示——讓繁瑣的運動會籌備工作變得井井有條。

以**澳門濠江中學**第三十屆田徑運動會為藍本，採用紅牆白瓦的北大官網設計風格，莊重典雅中不失青春的躍動。

---

## ✨ 核心功能

| 模塊 | 功能 |
|------|------|
| 🏠 **首頁大屏** | 開幕倒計時、賽事總覽、最新公告、實時成績公示 |
| 🏃 **賽事項目** | 短跑、長跑、跳躍、投擲、接力、集體項目全覆蓋 |
| 📝 **在線報名** | 一鍵報名、名額限制、重複檢測、審核流程 |
| 📅 **賽程編排** | 自動編排 + 手動調整、場地衝突檢測、一鍵發布 |
| 🏆 **成績管理** | 成績錄入、自動排名、獎項匹配、批量導入導出 |
| 📊 **數據統計** | 班級排名、年級對比、可視化圖表、Excel/CSV導出 |
| 📢 **公告通知** | 分類公告、置頂功能、已讀標記、站內通知推送 |
| 👤 **用戶管理** | 批量導入、角色權限、操作日誌、自定義頭像 |
| 🔒 **安全機制** | 驗證碼登錄、JWT認證、密碼加密、防暴力破解 |

---

## 🎨 設計理念

> *紅牆映日，金線描邊。書卷氣與競技魂在此交融。*

- **配色**：正紅 `#A80000` 為主調，深灰為輔，金色點綴獎項榮耀
- **佈局**：左主區 70% + 右側欄 30%，信息層次分明
- **字體**：微軟雅黑為主，標題加粗彰顯穩重
- **響應式**：桌面、平板、手機三端適配

---

## 🚀 快速開始

### 環境要求

- **Node.js** ≥ 16.x
- **npm** ≥ 8.x

### 安裝運行

```bash
# 克隆倉庫
git clone https://github.com/linjie20091027-a11y/sports-meet.git
cd sports-meet

# 安裝依賴
npm install

# 啟動服務
node server.js
```

瀏覽器訪問 `http://localhost:3000`

### 默認賬號

| 角色 | 郵箱 | 密碼 |
|------|------|------|
| 管理員 | `admin@hkms.hktedu.com` | `admin123` |
| 管理員 | `2100@hkms.hktedu.com` | `admin123` |
| 管理員 | `0037@hkms.hktedu.com` | `admin123` |
| 學生 | `20250001@hkms.hktedu.com` | `123456` |

---

## 📂 項目結構

```
sports-meet/
├── server.js                  # 服務入口
├── package.json               # 依賴配置
├── database/
│   └── init.js                # 數據庫初始化與種子數據
├── middleware/
│   └── auth.js                # JWT 認證中間件
├── routes/
│   ├── auth.js                # 登錄/註冊/驗證碼
│   ├── public.js              # 公共API（無需登錄）
│   ├── admin.js               # 管理員API（53個端點）
│   └── student.js             # 學生API（含報名、通知）
└── public/
    ├── index.html             # SPA 主頁面
    ├── css/
    │   └── style.css          # 全局樣式
    └── js/
        ├── api.js             # API 封裝層
        ├── app.js             # 路由、彈窗、Toast
        ├── auth.js            # 登錄註冊邏輯
        ├── admin.js           # 管理後台
        └── student.js         # 學生中心
```

---

## 🤝 協作開發

```bash
# 拉取最新代碼
git pull

# 創建功能分支
git checkout -b feature/新功能

# 提交改動
git add .
git commit -m "✨ 新增：某某功能"
git push origin feature/新功能
```

提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/) 規範：

| 前綴 | 含義 |
|------|------|
| `✨` | 新功能 |
| `🐛` | 修復Bug |
| `🎨` | 樣式調整 |
| `📝` | 文檔更新 |
| `♻️` | 代碼重構 |

---

## 📄 開源協議

本項目採用 [MIT License](LICENSE) 開源，歡迎 Star ⭐ 與貢獻。

---

<p align="center">
  <sub>Made with ❤️ for 澳門濠江中學 · 第三十屆田徑運動會</sub>
  <br>
  <sub>Rua do Comandante João Belo, Macau · 2026</sub>
</p>
