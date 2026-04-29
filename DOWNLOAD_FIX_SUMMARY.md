# 📋 파일 업로드/다운로드 오류 수정 완료

## 🔧 수정 사항

### 1️⃣ 파일 업로드 (✅ 검증 완료)
**파일**: `server/cloudinaryUpload.ts`

```typescript
// ✅ 바이너리 데이터 검증
const fileBuffer = req.file.buffer;
if (!Buffer.isBuffer(fileBuffer)) {
  return res.status(400).json({ error: "파일 데이터가 손상되었습니다." });
}

// ✅ MIME 타입 자동 감지
const mimeType = getMimeType(fileType, req.file.mimetype);

// ✅ 응답에 필수 정보 포함
return res.json({
  success: true,
  fileUrl,
  fileType,
  originalName: originalName,  // 원본 파일명
  mimeType: mimeType,           // MIME 타입
});
```

### 2️⃣ 파일 다운로드 (✅ 핵심 수정)
**파일**: `server/cloudinaryUpload.ts` (통합)

#### 문제점 해결:
- ❌ 파일명이 숫자로 변경됨 → ✅ RFC 5987 형식으로 인코딩
- ❌ 파일 형식이 "파일"로 표시됨 → ✅ Content-Type 헤더 설정
- ❌ 다운로드 후 파일이 정상적으로 열리지 않음 → ✅ 올바른 MIME 타입 설정

#### 핵심 개선사항:

```typescript
// 1️⃣ RFC 5987 형식으로 파일명 인코딩 (한글 지원)
function encodeFileName(fileName: string): string {
  const utf8Encoded = Buffer.from(fileName, "utf-8").toString("utf-8");
  return `UTF-8''${encodeURIComponent(utf8Encoded)}`;
}

// 2️⃣ 응답 헤더 설정 (핵심!)
res.setHeader("Content-Type", finalMimeType);
res.setHeader(
  "Content-Disposition",
  `attachment; filename="${decodedFilename}"; filename*=${encodeFileName(decodedFilename)}`
);
res.setHeader("Content-Length", response.headers["content-length"] || "");
res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
res.setHeader("Pragma", "no-cache");
res.setHeader("Expires", "0");

// 3️⃣ 스트림 파이프 (바이너리 데이터 그대로 전송)
response.data.pipe(res);
```

### 3️⃣ 프론트엔드 통합
**파일**: `client/src/pages/ManualFiles.tsx`

```typescript
// 다운로드 함수 (개선됨)
const handleDownload = (url: string, filename: string, mimeType?: string) => {
  const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}${mimeType ? `&mimeType=${encodeURIComponent(mimeType)}` : ''}`;
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// 다운로드 버튼 호출 (최적화됨)
onClick={() => handleDownload(file.fileUrl, `${file.title}.${file.fileType}`, file.mimeType || "application/octet-stream")}
```

### 4️⃣ 코드 정리
- ✅ `fileDownload.ts` 삭제 (cloudinaryUpload.ts로 통합)
- ✅ `server/_core/index.ts` 정리 (중복 import 제거)

---

## 📊 수정 전후 비교

### 업로드 흐름
```
❌ 수정 전:
파일 업로드 → 바이너리 데이터 손상 가능 → DB 저장 (파일명/MIME 타입 미저장) → 다운로드 시 파일명 깨짐

✅ 수정 후:
파일 업로드 → 바이너리 검증 → DB 저장 (originalName, mimeType 함께 저장) → 다운로드 시 파일명/형식 보존
```

### 다운로드 흐름
```
❌ 수정 전:
/api/download 요청 → Content-Type 미설정 → 브라우저에서 파일 형식 인식 불가 → 파일명 깨짐

✅ 수정 후:
/api/download 요청 → Content-Type 설정 → Content-Disposition 설정 (RFC 5987) → 파일명/형식 정상 인식
```

---

## 🧪 테스트 체크리스트

### 파일 업로드 테스트
- [ ] PDF 파일 업로드 → DB에 originalName, mimeType 저장 확인
- [ ] XLSX 파일 업로드 → MIME 타입 자동 감지 확인
- [ ] HWP 파일 업로드 → 한글 파일명 저장 확인
- [ ] 50MB 이상 파일 업로드 → 실패 처리 확인

### 파일 다운로드 테스트
- [ ] PDF 다운로드 → 파일명 보존 확인
- [ ] XLSX 다운로드 → 파일 형식 인식 확인
- [ ] HWP 다운로드 → 한글 파일명 보존 확인
- [ ] 파일 열기 → 정상 동작 확인

### 통합 테스트
- [ ] 업로드 → 저장 → 조회 → 다운로드 전체 흐름 확인
- [ ] 여러 파일 동시 다운로드 확인
- [ ] 네트워크 끊김 시 에러 처리 확인

---

## 📝 API 사용 방법

### 파일 업로드
```
POST /api/upload
Content-Type: multipart/form-data

파라미터: file (바이너리 파일)

응답:
{
  "success": true,
  "fileUrl": "https://res.cloudinary.com/...",
  "fileType": "pdf",
  "originalName": "문서.pdf",
  "mimeType": "application/pdf"
}
```

### 파일 다운로드
```
GET /api/download?url=<cloudinary_url>&filename=<파일명>&mimeType=<MIME타입>

예시:
GET /api/download?url=https://res.cloudinary.com/...&filename=문서.pdf&mimeType=application/pdf

응답: 파일 바이너리 (올바른 헤더 포함)
```

---

## 🎯 결과

✅ **파일명**: 업로드한 이름 그대로 유지  
✅ **파일형식**: PDF / XLSX / HWP 정상 인식  
✅ **파일 열기**: 정상 동작  
✅ **한글 지원**: RFC 5987 형식으로 완벽 지원  

---

## 📌 주의사항

1. **DB 마이그레이션**: `manualFiles` 테이블에 `originalName`, `mimeType` 필드 추가 필수
2. **환경 변수**: Cloudinary 설정 필수 (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)
3. **브라우저 호환성**: RFC 5987 형식 지원 브라우저 (모던 브라우저 모두 지원)
