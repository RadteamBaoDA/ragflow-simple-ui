import Joyride, { CallBackProps, Step, STATUS, EVENTS } from 'react-joyride';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { IJoyrideStep } from '../data/types';
import { LanguageCode } from '@/i18n';

interface GuidedTourProps {
    steps: IJoyrideStep[];
    run: boolean;
    onTourFinish: () => void;
}

export function GuidedTour({ steps, run, onTourFinish }: GuidedTourProps) {
    const { t, i18n } = useTranslation();
    const currentLang = (i18n.language || 'en') as LanguageCode & string;

    const handleCallback = (data: CallBackProps) => {
        const { status, type } = data;

        if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status as any) || type === EVENTS.TOUR_END) {
            onTourFinish();
        }
    };

    const joyrideSteps: Step[] = useMemo(() => {
        return steps.map(step => ({
            target: step.target,
            content: step.content[currentLang] || step.content['en'],
            placement: step.placement || 'bottom',
            disableBeacon: true,
            disableOverlayClose: true,
            spotlightPadding: 5,
        }));
    }, [steps, currentLang]);

    return (
        <Joyride
            steps={joyrideSteps}
            run={run}
            continuous
            showProgress
            showSkipButton
            callback={handleCallback}
            locale={{
                back: t('guideline.tour.back', 'Back'),
                close: t('guideline.tour.skip', 'Close'),
                last: t('guideline.tour.last', 'Finish'),
                next: t('guideline.tour.next', 'Next'),
                skip: t('guideline.tour.skip', 'Skip'),
            }}
            styles={{
                options: {
                    primaryColor: '#2563eb', // blue-600
                    zIndex: 10000,
                },
                tooltipContainer: {
                    textAlign: 'left'
                },
                buttonNext: {
                    backgroundColor: '#2563eb',
                },
                buttonBack: {
                    color: '#64748b', // slate-500
                }
            }}
        />
    );
}
