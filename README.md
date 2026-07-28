# LegoSearch

一個本機執行的樂高價格搜尋聚合器，第一版支援：

- 蝦皮
- MOMO
- PChome
- 酷澎 Coupang Taiwan

這個版本的目標是先建立穩定架構：每個平台各自有 connector，後端統一標準化商品資料，前端負責搜尋、排序、平台篩選與快取狀態顯示。

## 快速開始

需求：Node.js 22 或以上。

```powershell
npm start
```

打開：

```text
http://localhost:5178
```

## 使用方式

1. 輸入樂高關鍵字，例如 `LEGO 10305`、`樂高 75367`。
2. 選擇要搜尋的平台。
3. 點擊「搜尋價格」。
4. 結果會依價格排序，也會顯示平台、商品圖片、原始連結與抓取時間。

## 架構

```text
public/            本機網頁 UI
server/index.mjs   HTTP server 與 API
server/platforms.mjs
                   各平台 connector
server/scrape.mjs  HTML / JSON-LD 價格解析輔助
server/cache.mjs   SQLite 快取
data/cache.sqlite  執行後自動建立，不進版控
```

## API

```text
GET /api/platforms
GET /api/search?q=LEGO%2010305
GET /api/search?q=LEGO%2010305&platforms=pc-home,shopee&refresh=1
```

搜尋回傳格式：

```json
{
  "query": "LEGO 10305",
  "cached": false,
  "results": [
    {
      "platform": "PChome",
      "title": "LEGO ...",
      "price": 12999,
      "currency": "TWD",
      "url": "https://...",
      "image": "https://...",
      "source": "api",
      "fetchedAt": "2026-07-28T..."
    }
  ],
  "errors": []
}
```

## 注意事項

電商平台頁面會改版，也可能有反爬、登入、地區或動態載入限制。第一版採用三層策略：

1. PChome 優先使用公開搜尋 JSON 端點。
2. 蝦皮嘗試搜尋 API，失敗時退回搜尋頁連結。
3. MOMO 與酷澎先以搜尋頁 HTML / JSON-LD 嘗試解析，失敗時保留平台搜尋入口。

後續如果要提升準確度，建議加入官方聯盟 API、Playwright 瀏覽器擷取、排程更新與價格歷史表。
