const path = require('path');
const { resolveConfig, transform } = require('@svgr/core');
const upstreamTransformer = require('@expo/metro-config/babel-transformer');

const defaultSVGRConfig = {
	native: true,
	plugins: ['@svgr/plugin-svgo', '@svgr/plugin-jsx'],
	svgoConfig: {
		plugins: [
			{
				name: 'preset-default',
				params: {
					overrides: {
						inlineStyles: {
							onlyMatchedOnce: false,
						},
						removeViewBox: false,
						removeUnknownsAndDefaults: false,
						convertColors: false,
					},
				},
			},
		],
	},
};

module.exports.transform = async ({ src, filename, ...rest }) => {
	if (filename.endsWith('.svg')) {
		const config = await resolveConfig(path.dirname(filename));
		const svgrConfig = config ? { ...defaultSVGRConfig, ...config } : defaultSVGRConfig;

		return upstreamTransformer.transform({
			src: await transform(src, svgrConfig, { filePath: filename }),
			filename,
			...rest,
		});
	}

	return upstreamTransformer.transform({ src, filename, ...rest });
};