/**
 * Create a clean, de-duplicated list of labels from values or objects.
 *
 * Objects may provide a `label`, `name`, `title`, or `event` property. Nested
 * arrays are supported so this helper can be used directly with API results.
 *
 * @param {unknown} input
 * @returns {string[]}
 */
function generateLabels(input) {
	const labels = new Set();

	const add = (value) => {
		if (Array.isArray(value)) {
			value.forEach(add);
			return;
		}

		if (value && typeof value === 'object') {
			['label', 'name', 'title', 'event'].forEach((key) => {
				if (key in value) add(value[key]);
			});
			return;
		}

		if (value === null || value === undefined) return;

		const label = String(value)
			.trim()
			.replace(/\s+/g, ' ')
			.replace(/[,:;]+$/g, '');

		if (label) labels.add(label);
	};

	add(input);
	return [...labels].sort((a, b) => a.localeCompare(b));
}

module.exports = generateLabels;
module.exports.generateLabels = generateLabels;
