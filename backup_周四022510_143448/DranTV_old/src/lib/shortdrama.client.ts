// 短剧API客户端

export interface ShortDramaCategory {
  type_id: number;
  type_name: string;
}

export interface ShortDramaItem {
  id: string;
  vod_id: number;
  name: string;
  cover: string;
  update_time: string;
  score: number;
  total_episodes?: string;
  vod_class?: string; // 添加分类字段
  vod_tag?: string; // 添加标签字段
}

export interface ShortDramaListResponse {
  total: number;
  totalPages: number;
  currentPage: number;
  list: ShortDramaItem[];
}

export interface ShortDramaCategoriesResponse {
  categories: ShortDramaCategory[];
  total: number;
}

export interface ShortDramaRecommendResponse {
  mode: string;
  categoryId: number;
  categoryName: string | null;
  total: number;
  items: ShortDramaItem[];
}

export interface ShortDramaSearchResponse {
  total: number;
  totalPages: number;
  currentPage: number;
  list: ShortDramaItem[];
}

export interface ShortDramaParseResponse {
  success: boolean;
  data?: {
    url?: string;
    urls?: string[];
    [key: string]: unknown;
  };
  error?: string;
}

// 获取分类种类
export const getShortDramaCategories =
  async (): Promise<ShortDramaCategoriesResponse> => {
    const response = await fetch('/api/shortdrama/categories');
    if (!response.ok) {
      throw new Error('Failed to fetch short drama categories');
    }
    return response.json();
  };

// 获取随机推荐
export const getShortDramaRecommend = async (params: {
  categoryId?: string;
  size?: string;
}): Promise<ShortDramaRecommendResponse> => {
  const searchParams = new URLSearchParams();
  if (params.categoryId) searchParams.append('categoryId', params.categoryId);
  if (params.size) searchParams.append('size', params.size);

  const url = `/api/shortdrama/recommend${
    searchParams.toString() ? `?${searchParams.toString()}` : ''
  }`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch short drama recommendations');
  }
  return response.json();
};

// 获取分类热搜
export const getShortDramaList = async (params: {
  categoryId: string;
  page?: string;
}): Promise<ShortDramaListResponse> => {
  const searchParams = new URLSearchParams();
  searchParams.append('categoryId', params.categoryId);
  if (params.page) searchParams.append('page', params.page);

  const url = `/api/shortdrama/list?${searchParams.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch short drama list');
  }
  return response.json();
};

// 根据名称搜剧
export const searchShortDrama = async (params: {
  name: string;
}): Promise<ShortDramaSearchResponse> => {
  const searchParams = new URLSearchParams();
  searchParams.append('name', params.name);

  const url = `/api/shortdrama/search?${searchParams.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to search short drama');
  }
  return response.json();
};

// 获取最新剧集
export const getShortDramaLatest = async (params: {
  page?: string;
}): Promise<ShortDramaItem[]> => {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.append('page', params.page);

  const url = `/api/shortdrama/latest${
    searchParams.toString() ? `?${searchParams.toString()}` : ''
  }`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch latest short drama');
  }
  return response.json();
};

// 获取单集地址
export const getShortDramaSingleParse = async (params: {
  id: string;
  episode?: number;
}): Promise<ShortDramaParseResponse> => {
  const searchParams = new URLSearchParams();
  searchParams.append('id', params.id);
  if (params.episode) searchParams.append('episode', params.episode.toString());

  const url = `/api/shortdrama/parse/single?${searchParams.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to parse single episode');
  }
  return response.json();
};

// 批量获取地址
export const getShortDramaBatchParse = async (params: {
  id: number;
  episodes?: string;
}): Promise<ShortDramaParseResponse> => {
  const searchParams = new URLSearchParams();
  searchParams.append('id', params.id.toString());
  if (params.episodes) searchParams.append('episodes', params.episodes);

  const url = `/api/shortdrama/parse/batch?${searchParams.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to parse batch episodes');
  }
  return response.json();
};

// 获取全集地址
export const getShortDramaAllParse = async (params: {
  id: number;
}): Promise<ShortDramaParseResponse> => {
  const searchParams = new URLSearchParams();
  searchParams.append('id', params.id.toString());

  const url = `/api/shortdrama/parse/all?${searchParams.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to parse all episodes');
  }
  return response.json();
};
