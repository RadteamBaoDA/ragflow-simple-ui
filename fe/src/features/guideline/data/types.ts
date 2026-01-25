export interface IGuidelineStep {
    id: string;
    title: Record<'en' | 'vi' | 'ja', string>;
    description: Record<'en' | 'vi' | 'ja', string>;
    details?: Record<'en' | 'vi' | 'ja', string[]>;
}

export interface IGuidelineTab {
    tabId: string;
    tabTitle: Record<'en' | 'vi' | 'ja', string>;
    steps: IGuidelineStep[];
}

export interface IJoyrideStep {
    target: string;
    content: Record<'en' | 'vi' | 'ja', string>;
    placement?: 'top' | 'bottom' | 'left' | 'right';
    disableBeacon?: boolean;
}

export interface IFeatureGuideline {
    featureId: string;
    roleRequired: 'user' | 'leader' | 'admin';
    overview: Record<'en' | 'vi' | 'ja', string>;
    overviewImage?: string;
    tabs: IGuidelineTab[];
    tourSteps?: IJoyrideStep[];
}
