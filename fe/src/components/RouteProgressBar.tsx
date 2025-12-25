// Shows top loading bar on route transitions using NProgress.
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';

// Configure NProgress
NProgress.configure({
    showSpinner: false,
    easing: 'ease',
    speed: 500,
    trickleSpeed: 200,
    minimum: 0.08
});

/**
 * Component that displays a top progress bar during route transitions.
 * Listens to location changes and triggers NProgress start/done.
 */
export const RouteProgressBar = () => {
    const location = useLocation();
    const [prevLoc, setPrevLoc] = useState("");

    useEffect(() => {
        // Skip if it's the same path (only query params change)
        if (location.pathname === prevLoc) return;

        setPrevLoc(location.pathname);
        NProgress.start();

        // Small timeout to ensure the bar is visible even for fast loads
        const timer = setTimeout(() => {
            NProgress.done();
        }, 100);

        return () => {
            clearTimeout(timer);
            NProgress.done();
        };
    }, [location, prevLoc]);

    return null;
};

export default RouteProgressBar;
