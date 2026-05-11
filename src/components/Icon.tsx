import React from 'react'

export type IconName =
	| 'check'
	| 'check-circle'
	| 'x'
	| 'x-circle'
	| 'info'
	| 'alert-triangle'
	| 'alert-circle'
	| 'shield'
	| 'shield-check'
	| 'bell'
	| 'mail'
	| 'car'
	| 'calendar'
	| 'chart'
	| 'file-text'
	| 'lock'
	| 'search'
	| 'chevron-right'
	| 'external-link'
	| 'plus'

interface IconProps {
	name: IconName
	size?: number | string
	className?: string
	style?: React.CSSProperties
	strokeWidth?: number
	'aria-label'?: string
}

const PATHS: Record<IconName, React.ReactNode> = {
	check: <path d='M20 6 9 17l-5-5' />,
	'check-circle': (
		<>
			<path d='M22 11.08V12a10 10 0 1 1-5.93-9.14' />
			<path d='m9 11 3 3L22 4' />
		</>
	),
	x: (
		<>
			<path d='M18 6 6 18' />
			<path d='m6 6 12 12' />
		</>
	),
	'x-circle': (
		<>
			<circle cx='12' cy='12' r='10' />
			<path d='m15 9-6 6' />
			<path d='m9 9 6 6' />
		</>
	),
	info: (
		<>
			<circle cx='12' cy='12' r='10' />
			<path d='M12 16v-4' />
			<path d='M12 8h.01' />
		</>
	),
	'alert-triangle': (
		<>
			<path d='m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z' />
			<path d='M12 9v4' />
			<path d='M12 17h.01' />
		</>
	),
	'alert-circle': (
		<>
			<circle cx='12' cy='12' r='10' />
			<path d='M12 8v4' />
			<path d='M12 16h.01' />
		</>
	),
	shield: (
		<path d='M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z' />
	),
	'shield-check': (
		<>
			<path d='M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z' />
			<path d='m9 12 2 2 4-4' />
		</>
	),
	bell: (
		<>
			<path d='M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9' />
			<path d='M10.3 21a1.94 1.94 0 0 0 3.4 0' />
		</>
	),
	mail: (
		<>
			<rect width='20' height='16' x='2' y='4' rx='2' />
			<path d='m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7' />
		</>
	),
	car: (
		<>
			<path d='M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2' />
			<circle cx='6.5' cy='16.5' r='2.5' />
			<circle cx='16.5' cy='16.5' r='2.5' />
		</>
	),
	calendar: (
		<>
			<rect width='18' height='18' x='3' y='4' rx='2' ry='2' />
			<path d='M16 2v4' />
			<path d='M8 2v4' />
			<path d='M3 10h18' />
		</>
	),
	chart: (
		<>
			<path d='M3 3v18h18' />
			<path d='M18 17V9' />
			<path d='M13 17V5' />
			<path d='M8 17v-3' />
		</>
	),
	'file-text': (
		<>
			<path d='M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z' />
			<path d='M14 2v6h6' />
			<path d='M16 13H8' />
			<path d='M16 17H8' />
			<path d='M10 9H8' />
		</>
	),
	lock: (
		<>
			<rect width='18' height='11' x='3' y='11' rx='2' ry='2' />
			<path d='M7 11V7a5 5 0 0 1 10 0v4' />
		</>
	),
	search: (
		<>
			<circle cx='11' cy='11' r='8' />
			<path d='m21 21-4.3-4.3' />
		</>
	),
	'chevron-right': <path d='m9 18 6-6-6-6' />,
	'external-link': (
		<>
			<path d='M15 3h6v6' />
			<path d='M10 14 21 3' />
			<path d='M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' />
		</>
	),
	plus: (
		<>
			<path d='M5 12h14' />
			<path d='M12 5v14' />
		</>
	),
}

const Icon: React.FC<IconProps> = ({
	name,
	size = 20,
	className,
	style,
	strokeWidth = 2,
	'aria-label': ariaLabel,
}) => {
	return (
		<svg
			xmlns='http://www.w3.org/2000/svg'
			width={size}
			height={size}
			viewBox='0 0 24 24'
			fill='none'
			stroke='currentColor'
			strokeWidth={strokeWidth}
			strokeLinecap='round'
			strokeLinejoin='round'
			className={className}
			style={style}
			aria-hidden={ariaLabel ? undefined : true}
			aria-label={ariaLabel}
			role={ariaLabel ? 'img' : undefined}
			focusable='false'
		>
			{PATHS[name]}
		</svg>
	)
}

export default Icon
