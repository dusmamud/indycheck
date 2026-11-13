// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';

const jsonLd = {
	'@context': 'https://schema.org',
	'@type': 'SoftwareApplication',
	name: 'indycheck',
	applicationCategory: 'DeveloperApplication',
	operatingSystem: 'Cross-platform',
	description:
		'Offline Indian ID validator — PAN, Aadhaar, GSTIN, IFSC, UPI ID, mobile number, PIN code, TAN, CIN, LLPIN, Voter ID and vehicle numbers. Rust core, zero dependencies, no network calls.',
	author: { '@type': 'Person', name: 'dusmamud' },
	offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
	softwareVersion: '0.2.5',
	url: 'https://indycheck.pages.dev/',
	downloadUrl: 'https://www.npmjs.com/package/indycheck',
	programmingLanguage: ['Rust', 'JavaScript', 'TypeScript', 'Python'],
	license: 'https://github.com/dusmamud/indycheck/blob/main/LICENSE',
};

// https://astro.build/config
export default defineConfig({
	site: 'https://indycheck.pages.dev',
	integrations: [
		starlight({
			title: 'indycheck',
			description:
				'Offline Indian ID validator — PAN, Aadhaar, GSTIN, IFSC, UPI, mobile, PIN, TAN, CIN, LLPIN, Voter ID and vehicle numbers. Rust core, zero dependencies.',
			logo: {
				src: './src/assets/logo.svg',
				alt: 'indycheck logo',
			},
			favicon: '/favicon.svg',
			customCss: ['./src/styles/custom.css'],
			lastUpdated: true,
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/dusmamud/indycheck' },
			],
			// Starlight generates a canonical link for every page from `site`.
			head: [
				{ tag: 'meta', attrs: { property: 'og:type', content: 'website' } },
				{ tag: 'meta', attrs: { property: 'og:site_name', content: 'indycheck' } },
				{ tag: 'meta', attrs: { property: 'og:title', content: 'indycheck — Offline Indian ID validator' } },
				{
					tag: 'meta',
					attrs: {
						property: 'og:description',
						content:
							'Validate PAN, Aadhaar, GSTIN, IFSC, UPI, mobile, PIN, TAN, CIN, LLPIN, Voter ID and vehicle numbers offline. Rust core, zero dependencies, Hindi + English error reasons.',
					},
				},
				{ tag: 'meta', attrs: { property: 'og:url', content: 'https://indycheck.pages.dev/' } },
				{ tag: 'meta', attrs: { property: 'og:image', content: 'https://indycheck.pages.dev/og.svg' } },
				{ tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
				{ tag: 'meta', attrs: { name: 'twitter:title', content: 'indycheck — Offline Indian ID validator' } },
				{
					tag: 'meta',
					attrs: {
						name: 'twitter:description',
						content:
							'Validate PAN, Aadhaar, GSTIN, IFSC, UPI, mobile, PIN, TAN, CIN, LLPIN, Voter ID and vehicle numbers offline. Rust core, zero dependencies.',
					},
				},
				{ tag: 'meta', attrs: { name: 'twitter:image', content: 'https://indycheck.pages.dev/og.svg' } },
				{
					tag: 'script',
					attrs: { type: 'application/ld+json' },
					content: JSON.stringify(jsonLd),
				},
			],
			editLink: {
				baseUrl: 'https://github.com/dusmamud/indycheck/edit/main/website/',
			},
			sidebar: [
				{
					label: 'Start here',
					items: [
						{ label: 'Getting started', slug: 'getting-started' },
						{ label: 'Changelog', slug: 'changelog' },
						{ label: 'FAQ', slug: 'faq' },
						{ label: 'Contributing', slug: 'contributing' },
					],
				},
				{
					label: 'Validators',
					items: [
						{ label: 'Mobile number', slug: 'mobile' },
						{ label: 'PAN', slug: 'pan' },
						{ label: 'Aadhaar', slug: 'aadhaar' },
						{ label: 'GSTIN', slug: 'gstin' },
						{ label: 'IFSC', slug: 'ifsc' },
						{ label: 'UPI ID', slug: 'upi' },
						{ label: 'PIN code', slug: 'pincode' },
						{ label: 'TAN', slug: 'tan' },
						{ label: 'CIN', slug: 'cin' },
						{ label: 'LLPIN', slug: 'llpin' },
						{ label: 'Voter ID (EPIC)', slug: 'epic' },
						{ label: 'Vehicle registration', slug: 'vehicle' },
					],
				},
				{
					label: 'Options & data',
					items: [
						{ label: 'Options', slug: 'options' },
						{ label: 'Error codes', slug: 'error-codes' },
						{ label: 'Masking & formatting', slug: 'masking-formatting' },
						{ label: 'Test-data generators', slug: 'generators' },
					],
				},
				{
					label: 'Languages & runtimes',
					items: [
						{ label: 'Flutter & Dart', slug: 'flutter' },
						{ label: 'PHP', slug: 'php' },
						{ label: 'Go', slug: 'go' },
						{ label: 'Kotlin', slug: 'kotlin' },
						{ label: 'Swift', slug: 'swift' },
						{ label: 'C API', slug: 'c' },
						{ label: 'Node.js native (napi-rs)', slug: 'node-napi' },
					],
				},
				{
					label: 'Reference',
					items: [
						{ label: 'API & error codes', slug: 'api' },
						{ label: 'Integrations', slug: 'integrations' },
						{ label: 'CLI', slug: 'cli' },
					],
				},
			],
		}),
		sitemap(),
	],
});
