import { IntlMessageFormat } from 'intl-messageformat';

export const intl = (function intlAutoInit() {
	let defaultLocale = '';
	let shouldFallbackToDefaultMessages = true;
	const availableLocales: string[] = [];
	const messageLoaders: SvelteFiveIntlMessageLoaders = {};
	const currentLoadingLocales: string[] = [];
	const catalog: SvelteFiveIntlMessages = {};
	const messages: Record<string, string> = $state({});
	let currentLocale = $state('');

	const api = {
		setDefaultLocale(locale: string) {
			defaultLocale = locale;
			return this;
		},
		getDefaultLocale() {
			return defaultLocale;
		},
		disableFallbackToDefaultMessages() {
			shouldFallbackToDefaultMessages = false;
			return this;
		},
		enableFallbackToDefaultMessages() {
			shouldFallbackToDefaultMessages = true;
			return this;
		},
		registerMessageLoader(locale: string, loader: SvelteFiveIntlMessageLoader) {
			messageLoaders[locale] = loader;
			if (!availableLocales.includes(locale)) availableLocales.push(locale);
			return this;
		},
		registerMessageLoaders(obj: SvelteFiveIntlMessageLoaders) {
			Object.keys(obj).map((filepath) => {
				const locale = extractLocaleFromFilePath(filepath);
				if (!locale)
					throw new Error(
						`Failed to extract locale from "${filepath}". The locale should be in aa-AA or aa_AA form.`
					);
				messageLoaders[locale] = obj[filepath];
				if (!availableLocales.includes(locale)) availableLocales.push(locale);
			});
			return this;
		},
		loadAllMessages(obj: SvelteFiveIntlMessages) {
			Object.keys(obj).map((filepath) => {
				const locale = extractLocaleFromFilePath(filepath);
				if (!locale)
					throw new Error(
						`Failed to extract locale from "${filepath}". The locale should be in aa-AA or aa_AA form.`
					);
				catalog[locale] = obj[filepath];
				messageLoaders[locale] = () => Promise.resolve(obj[filepath]);
				if (!availableLocales.includes(locale)) availableLocales.push(locale);
			});
		},
		isSupportedLocale(locale: string) {
			return locale && availableLocales.includes(locale);
		},
		getAvailableLocales() {
			return availableLocales;
		},
		async init(locale: string) {
			if (!Object.hasOwn(messageLoaders, locale)) {
				throw new Error(
					`Failed to init with locale "${locale}" because no message loader registered for it.`
				);
			}

			if (currentLoadingLocales.includes(locale)) {
				console.warn(`The messages for "${locale}" is currently being loaded.`);
				return this;
			}
			currentLoadingLocales.push(locale);

			if (!Object.hasOwn(catalog, locale)) {
				const content = await messageLoaders[locale]();
				// @ts-expect-error because typescript sucks
				catalog[locale] = content.default || content;
			}

			if (shouldFallbackToDefaultMessages && !Object.hasOwn(catalog, defaultLocale)) {
				const content2 = await messageLoaders[defaultLocale]();
				// @ts-expect-error because typescript sucks
				catalog[defaultLocale] = content2.default || content2;
			}

			updateTranslations(catalog[locale], catalog[defaultLocale]);

			currentLocale = locale;

			currentLoadingLocales.splice(currentLoadingLocales.indexOf(locale), 1);

			return this;
		},
		getCurrentLocale() {
			return currentLocale;
		},
		getMessage(key: string, fallbackKey: string | undefined, fallbackMessage: string | undefined) {
			return Object.hasOwn(messages, key)
				? messages[key]
				: fallbackKey
					? Object.hasOwn(messages, fallbackKey)
						? messages[fallbackKey]
						: (fallbackMessage ?? '')
					: (fallbackMessage ?? '');
		}
	};

	function updateTranslations(
		_messages: Record<string, string>,
		defaultMessages: Record<string, string>
	) {
		Object.keys(_messages).map((k) => (messages[k] = _messages[k]));

		if (shouldFallbackToDefaultMessages && api.getCurrentLocale() !== defaultLocale) {
			Object.keys(defaultMessages).map((k) =>
				!Object.hasOwn(_messages, k) ? (messages[k] = defaultMessages[k]) : null
			);
		}
	}

	function extractLocaleFromFilePath(filepath: string) {
		const pattern = /(?=(\/|.|-|_))[a-z]{2}(-|_)[A-Z]{2}(?=(\/|.|-|_))/;
		const match = filepath.match(pattern);
		return match ? match[0] : null;
	}

	return api;
})();

export function _(key: string, formattingOpts: SvelteFiveIntlFormattingOpts = { values: {} }) {
	return new IntlMessageFormat(
		intl.getMessage(key, formattingOpts.fallbackKey, formattingOpts.fallbackMessage),
		intl.getCurrentLocale() || intl.getDefaultLocale()
	).format(formattingOpts.values ?? {}) as string;
}

export function extractLocaleFromUrl(url: string) {
	const pattern = /\b[a-z]{2}(-|_)[a-zA-Z]{2}\b/;
	const match = url.match(pattern);
	return match
		? match[0]
				.split('-')
				.map((portion, i) => (i === 1 ? portion.toUpperCase() : portion))
				.join('-')
		: null;
}

export type SvelteFiveIntlMessageLoader = () => Promise<
	Record<string, string> | { default: Record<string, string> }
>;
export type SvelteFiveIntlMessageLoaders = Record<string, SvelteFiveIntlMessageLoader>;
export type SvelteFiveIntlMessages = Record<string, Record<string, string>>;

export interface SvelteFiveIntlFormattingOpts {
	values: Record<string, string>;
	fallbackKey?: string;
	fallbackMessage?: string;
}
