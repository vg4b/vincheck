import { type Metric, onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals'

// Forward Core Web Vitals to GA4 (gtag is configured in GoogleAnalytics.tsx).
// gtag respects the site's Consent Mode v2 default, so nothing is stored before
// the user consents. CLS is unitless → scaled x1000 so GA shows a usable integer.
function sendToGA4(metric: Metric): void {
	const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void })
		.gtag
	if (typeof gtag !== 'function') return
	gtag('event', metric.name, {
		value: Math.round(
			metric.name === 'CLS' ? metric.value * 1000 : metric.value
		),
		metric_id: metric.id,
		metric_value: metric.value,
		metric_delta: metric.delta,
		metric_rating: metric.rating,
		non_interaction: true
	})
}

// Core Web Vitals: LCP, INP (replaced FID in 2024), CLS — plus FCP and TTFB.
const reportWebVitals = (): void => {
	onCLS(sendToGA4)
	onINP(sendToGA4)
	onLCP(sendToGA4)
	onFCP(sendToGA4)
	onTTFB(sendToGA4)
}

export default reportWebVitals
