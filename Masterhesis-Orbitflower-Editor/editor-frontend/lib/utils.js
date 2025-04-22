function has_subset(arr, otherArray) {
  return is_subset(otherArray, arr);
}
function is_subset(arr, otherArray) {
  return arr.every((element) => otherArray.includes(element));
}

function open(filePath, callback) {
  const fs = require("fs");

  fs.readFile(filePath, "utf8", (err, data) => {
    if (err) {
      throw err;
    }

    const doc = new DOMParser().parseFromString(data, "application/xml");

    callback(doc);
  });
}
