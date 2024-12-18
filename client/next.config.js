const withNextra = require("nextra")({
	theme: "nextra-theme-docs",
	themeConfig: "./theme.config.jsx",
});

module.exports = withNextra({
	compiler: {
		removeConsole: process.env.NODE_ENV === "production",
	},
});
