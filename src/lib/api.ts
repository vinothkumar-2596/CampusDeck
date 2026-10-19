export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch("/api" + path, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers },
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "The request could not be completed.");
  return data;
}
export function send<T = unknown>(
  path: string,
  body: unknown,
  method = "POST",
) {
  return api<T>(path, { method, body: JSON.stringify(body) });
}
export async function readImage(file: File): Promise<string> {
  if (!["image/png", "image/jpeg"].includes(file.type))
    throw new Error("Choose a PNG or JPEG image.");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Choose an image under 10 MB.");
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read this image."));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("This image could not be opened."));
    image.src = raw;
  });
  const scale = Math.min(1, 1400 / Math.max(img.width, img.height)),
    canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing is not available.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  let result = canvas.toDataURL(file.type, 0.8);
  if (result.length > 690000) result = canvas.toDataURL("image/jpeg", 0.65);
  if (result.length > 690000)
    throw new Error(
      "This image is too detailed. Please choose a smaller image.",
    );
  return result;
}
