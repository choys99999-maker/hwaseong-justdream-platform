/**
 * 기부 사진을 올리기 전 리사이즈+압축한다. 휴대폰 카메라 원본(수 MB, 4000px대)을 그대로 올리면
 * 느린 회선에서 업로드가 오래 걸리거나 실패하기 쉽다 — 화면에 보일 크기면 충분하다.
 */
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

export async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file; // 디코딩 실패 시 원본 그대로 올린다 — 실패보다는 큰 파일이 낫다.

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  );
  if (!blob || blob.size >= file.size) return file; // 압축이 더 크면 원본을 쓴다.

  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg' });
}
