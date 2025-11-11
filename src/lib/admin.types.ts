export interface AdminConfig {
  ConfigSubscribtion: {
    URL: string;
    AutoUpdate: boolean;
    LastCheck: string;
  };
  ConfigFile: string;
  SourceSubscription?: {
    URL: string;
    AutoUpdate: boolean;
    LastCheck: string;
  };
  LiveSubscription?: {
    URL: string;
    AutoUpdate: boolean;
    LastCheck: string;
  };
  SiteConfig: {
    SiteName: string;
    Announcement: string;
    SearchDownstreamMaxPage: number;
    SiteInterfaceCacheTime: number;
    DoubanProxyType: string;
    DoubanProxy: string;
    DoubanImageProxyType: string;
    DoubanImageProxy: string;
    DisableYellowFilter: boolean;
    FluidSearch: boolean;
    RequireDeviceCode: boolean;
    CustomTheme?: {
      selectedTheme: string;
      customCSS: string;
    };
  };
  ThemeConfig?: {
    defaultTheme: 'default' | 'minimal' | 'warm' | 'fresh';
    customCSS: string;
    allowUserCustomization: boolean;
  };
  ImageHostingConfig?: {
    type:
      | 'S3'
      | 'RemoteAPI'
      | 'FTP'
      | 'DogeCloud'
      | 'AliyunOSS'
      | 'Github'
      | 'YoupaiyunUSS';
    s3?: {
      accessKeyId: string;
      secretAccessKey: string;
      bucket: string;
      endpoint: string;
      region: string;
      pathFormat: string;
      customDomain: string;
    };
    remoteApi?: {
      url: string;
      token?: string;
      field?: string;
    };
    ftp?: {
      host: string;
      port: number;
      username: string;
      password: string;
      path: string;
      customDomain: string;
    };
    dogeCloud?: {
      accessKey: string;
      secretKey: string;
      bucket: string;
      region: string;
      customDomain: string;
    };
    aliyunOss?: {
      accessKeyId: string;
      accessKeySecret: string;
      bucket: string;
      region: string;
      customDomain: string;
    };
    github?: {
      token: string;
      owner: string;
      repo: string;
      branch: string;
      path: string;
      customDomain: string;
    };
    youpaiyun?: {
      operator: string;
      password: string;
      bucket: string;
      customDomain: string;
    };
  };
  UserConfig: {
    Users: {
      username: string;
      role: 'user' | 'admin' | 'owner';
      banned?: boolean;
      enabledApis?: string[]; // 优先级高于tags限制
      tags?: string[]; // 多 tags 取并集限制
    }[];
    Tags?: {
      name: string;
      enabledApis: string[];
    }[];
  };
  SourceConfig: {
    key: string;
    name: string;
    api: string;
    detail?: string;
    from: 'config' | 'custom' | 'subscription';
    disabled?: boolean;
  }[];
  CustomCategories: {
    name?: string;
    type: 'movie' | 'tv';
    query: string;
    from: 'config' | 'custom';
    disabled?: boolean;
  }[];
  LiveConfig?: {
    key: string;
    name: string;
    url: string; // m3u 地址
    ua?: string;
    epg?: string; // 节目单
    from: 'config' | 'custom' | 'subscription';
    channelNumber?: number;
    disabled?: boolean;
  }[];
}

export interface AdminConfigResult {
  Role: 'owner' | 'admin';
  Config: AdminConfig;
}
