const UglifyJsPlugin = require("uglifyjs-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");

module.exports = {
	entry: {
        login: '/public/assets/js/e/login.js',
        home: '/public/assets/js/e/home.js',
        schedule: '/public/assets/js/e/schedule.js',
        setting: '/public/assets/js/e/setting.js',
        users: '/public/assets/js/e/users.js',
    },
	mode: "production",
	output: {
		path: `${__dirname}/public/static`,
		filename: "[name].chunk.js",
		environment: {
			arrowFunction: false
		}
	},
	plugins: [
		new MiniCssExtractPlugin({
			filename: '[name].chunk.css',
		})
	],
	module: {
		rules: [
			{
				test: /\.css$/,
				use: [MiniCssExtractPlugin.loader, "css-loader"],
			},
			{
				test: /\.(svg|gif|png|eot|woff|ttf)$/,
				use: ["url-loader"],
			},
            {
                test: /\.js$/,
                exclude: /(node_modules|bower_components)/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env'],
                    },
                },
            },
		],
	},
	optimization: {
		// splitChunks: {
		// 	chunks: 'all',
		// },
		minimize: true,
		minimizer: [
			// new TerserPlugin({
			// 	extractComments: false,
			// }),
			new UglifyJsPlugin({
				test: /\.js(\?.*)?$/i,
				sourceMap: true,
                extractComments: true,
			}),
			new CssMinimizerPlugin(),
		],
	},
};