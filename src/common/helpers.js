export function findMatchingUrlTemplate(url, templates) {
  // not efficient since JS map is not lazy
  const result = templates
    .map((template) => matchTemplateCandidate(url, template))
    .filter((templateResult) => templateResult)[0];

  console.log("url", url, "candidates", templates, "result", result);

  return result;
}

function matchTemplateCandidate(url, template) {
  const urlSegments = url.split("/");
  const templateSegments = template.split("/");

  if (urlSegments.length !== templateSegments.length) {
    return;
  }

  const params = {};
  for (let i = 0; i < urlSegments.length; i++) {
    if (urlSegments[i] === templateSegments[i]) continue;

    // check if template segment is a param placeholder
    if (
      templateSegments[i].startsWith("[") &&
      templateSegments[i].endsWith("]")
    ) {
      const param = templateSegments[i].substring(
        1,
        templateSegments[i].length - 1
      );
      params[param] = urlSegments[i];
      continue;
    }

    return;
  }

  return {
    template,
    params,
  };
}
