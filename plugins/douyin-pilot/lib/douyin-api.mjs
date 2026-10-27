/**
 * 抖音开放平台 API 封装（零依赖，Node 24 全局 fetch）。
 *
 * ⚠️ 接口版本核对：抖音开放平台同时存在两套路径 ——
 *   v1     新版：/api/douyin/v1/...（2024 起逐步替换旧版）
 *   legacy 旧版：/video/create/、/data/external/... 等
 * 应用过审后以控制台实际开通能力为准，见插件 README「接口核对清单」。
 * 若路径有变，只改本文件 API_BASES，不动工具层。
 */

const OAUTH = {
  authorize: "https://www.douyin.com/open/auth/",
  token: "https://open.douyin.com/oauth/access_token/",
  refresh: "https://open.douyin.com/oauth/refresh_token/",
  userInfo: "https://open.douyin.com/oauth/userinfo/",
};

const API_BASES = {
  v1: {
    uploadVideo: "https://open.douyin.com/api/douyin/v1/video/upload_video/",
    createVideo: "https://open.douyin.com/api/douyin/v1/video/create_video/",
    videoList: "https://open.douyin.com/api/douyin/v1/video/list/",
    itemStatus: "https://open.douyin.com/api/douyin/v1/video/item_status/",
    userBase: "https://open.douyin.com/api/douyin/v1/data/external/user/base/",
    videoBase: "https://open.douyin.com/api/douyin/v1/data/external/video/base/",
    commentList: "https://open.douyin.com/api/douyin/v1/comment/list/",
    commentReply: "https://open.douyin.com/api/douyin/v1/comment/reply/create/",
  },
  legacy: {
    uploadVideo: "https://open.douyin.com/video/upload/",
    createVideo: "https://open.douyin.com/video/create/",
    videoList: "https://open.douyin.com/video/list/",
    itemStatus: "https://open.douyin.com/video/status/",
    userBase: "https://open.douyin.com/data/external/user/base/",
    videoBase: "https://open.douyin.com/data/external/video/base/",
    commentList: "https://open.douyin.com/comment/list/",
    commentReply: "https://open.douyin.com/comment/reply/create/",
  },
};

export function apiBase(mode) {
  return API_BASES[mode] ?? API_BASES.v1;
}

/** 统一解包抖音响应：HTTP 200 但 body.data.error_code != 0 视为业务失败。 */
async function unwrap(res) {
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`抖音接口返回非 JSON（HTTP ${res.status}）：${text.slice(0, 300)}`);
  }
  const data = body?.data ?? body;
  const errCode = data?.error_code ?? body?.error_code;
  if (errCode === undefined || errCode === 0) return data;
  const desc = data?.description || body?.description || body?.message || "";
  const err = new Error(`抖音接口错误 ${errCode}：${desc}`);
  err.code = errCode;
  throw err;
}

/* ---------------- OAuth ---------------- */

/** 生成授权页链接。scope 用逗号分隔；state 用于回调防伪。 */
export function authorizeUrl(config, state) {
  const url = new URL(OAUTH.authorize);
  url.searchParams.set("client_key", config.clientKey);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scopes);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

/** 用授权 code 换 access_token。返回 { openId, accessToken, refreshToken, expiresAt, scope }。 */
export async function exchangeCode(config, code) {
  const url = new URL(OAUTH.token);
  url.searchParams.set("client_key", config.clientKey);
  url.searchParams.set("client_secret", config.clientSecret);
  url.searchParams.set("code", code);
  url.searchParams.set("grant_type", "authorization_code");
  const data = await unwrap(await fetch(url, { method: "POST" }));
  return {
    openId: data.open_id,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + Number(data.expires_in ?? 86400) * 1000 - 5 * 60 * 1000,
    scope: data.scope ?? "",
  };
}

/** 用 refresh_token 换新 access_token。 */
export async function refreshToken(config, refreshTokenValue) {
  const url = new URL(OAUTH.refresh);
  url.searchParams.set("client_key", config.clientKey);
  url.searchParams.set("grant_type", "refresh_token");
  url.searchParams.set("refresh_token", refreshTokenValue);
  const data = await unwrap(await fetch(url, { method: "POST" }));
  return {
    openId: data.open_id,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshTokenValue,
    expiresAt: Date.now() + Number(data.expires_in ?? 86400) * 1000 - 5 * 60 * 1000,
    scope: data.scope ?? "",
  };
}

/** 授权用户信息（昵称/头像），失败不抛错，返回 null。 */
export async function userInfo(accessToken, openId) {
  try {
    const url = new URL(OAUTH.userInfo);
    url.searchParams.set("access_token", accessToken);
    url.searchParams.set("open_id", openId);
    const data = await unwrap(await fetch(url));
    return { nickname: data.nickname ?? "", avatar: data.avatar ?? "" };
  } catch {
    return null;
  }
}

/* ---------------- 发布 ---------------- */

/**
 * 上传视频文件（单次直传）。>8GB/大文件应改用分片上传（upload_video_part），
 * AI 生成的短片通常 <100MB，直传够用。返回 video_id。
 */
export async function uploadVideo(accessToken, mode, filePath) {
  const { readFile } = await import("node:fs/promises");
  const buf = await readFile(filePath);
  const form = new FormData();
  form.append("video", new Blob([buf], { type: "video/mp4" }), filePath.split("/").pop());
  const data = await unwrap(
    await fetch(apiBase(mode).uploadVideo, {
      method: "POST",
      headers: { "access-token": accessToken },
      body: form,
    })
  );
  return data.video?.video_id ?? data.video_id ?? data.data?.video_id;
}

/** 发布视频。text 为标题+话题（话题写作 #xxx#），返回 { itemId, publishId }。 */
export async function createVideo(accessToken, mode, { videoId, text, poiId }) {
  const body = { video_id: videoId, text };
  if (poiId) body.poi_id = poiId;
  const data = await unwrap(
    await fetch(apiBase(mode).createVideo, {
      method: "POST",
      headers: { "access-token": accessToken, "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
  return { itemId: data.item_id, publishId: data.publish_id ?? data.item_id };
}

/* ---------------- 数据 ---------------- */

/** 账号概况数据（粉丝、点赞、播放等）。dateRange 如 "7d"。 */
export async function userBaseData(accessToken, mode, dateRange = "7d") {
  const url = new URL(apiBase(mode).userBase);
  url.searchParams.set("date_range", dateRange);
  return unwrap(await fetch(url, { headers: { "access-token": accessToken } }));
}

/** 视频基础数据（播放/点赞/评论/完播）。itemIds 逗号分隔字符串。 */
export async function videoBaseData(accessToken, mode, itemIds, dateRange = "7d") {
  const url = new URL(apiBase(mode).videoBase);
  url.searchParams.set("item_ids", itemIds);
  url.searchParams.set("date_range", dateRange);
  return unwrap(await fetch(url, { headers: { "access-token": accessToken } }));
}

/** 已发布视频列表（翻页）。 */
export async function videoList(accessToken, mode, { cursor = 0, count = 10 } = {}) {
  const url = new URL(apiBase(mode).videoList);
  url.searchParams.set("cursor", String(cursor));
  url.searchParams.set("count", String(count));
  return unwrap(await fetch(url, { headers: { "access-token": accessToken } }));
}

/* ---------------- 评论 ---------------- */

/** 视频评论列表。 */
export async function commentList(accessToken, mode, itemId, { cursor = 0, count = 20 } = {}) {
  const url = new URL(apiBase(mode).commentList);
  url.searchParams.set("item_id", itemId);
  url.searchParams.set("cursor", String(cursor));
  url.searchParams.set("count", String(count));
  return unwrap(await fetch(url, { headers: { "access-token": accessToken } }));
}

/** 回复评论。 */
export async function commentReply(accessToken, mode, { itemId, commentId, content }) {
  const body = { item_id: itemId, comment_id: commentId, content };
  return unwrap(
    await fetch(apiBase(mode).commentReply, {
      method: "POST",
      headers: { "access-token": accessToken, "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}
