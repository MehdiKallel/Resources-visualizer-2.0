document.addEventListener("DOMContentLoaded", function () {
  try {
    // Check if data exists in localStorage
    const xmlString = localStorage.getItem("organisationXML");
    const timestamp = localStorage.getItem("organisationDataTimestamp");

    if (!xmlString) {
      console.warn("No organisation data found in localStorage");
      return null;
    }

    console.log(`Loading organisation data (saved at ${timestamp})`);

    // Parse the XML string into a document
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");

    console.log(xmlDoc);
    // Check if parsing was successful
    if (xmlDoc.querySelector("parsererror")) {
      console.error("Failed to parse organization XML");
      return null;
    }

    return xmlDoc;
  } catch (error) {
    console.error("Error retrieving organisation data:", error);
    return null;
  }
});
