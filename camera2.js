const camera = document.getElementById("camera");
const captureButton = document.getElementById("capture");
const uploadButton = document.getElementById("upload");
const photoContainer = document.getElementById("photo-container");
const projectSelect = document.getElementById("project-select");

let photos = [];

// API configurations
const googleAccessToken = "ya29.a0ARW5m77XE25oLh6cpFL6vjnOqNOgOYqVBjiRS9k3I3olcD1mRCqGANETLG1W6yeAc8JyEETi8DkeESSNy_MkA9NmQb6OKqP6Rwzt0cKt321MTT1rs1_0nRkDUT-MS2wXUI0BJFNo_JBCsropVPjHCKxJGmtK5oOgyRUUd7SHaCgYKAToSARMSFQHGX2Mi6PDeqbGiGUWHOTh4p4ZJ0A0175"; // Replace with your Google Drive access token
const airtableApiKey = "keyMSO5YdUS8xdXiB"; // Replace with your Airtable API key
const airtableBaseId = "A8TA3rL3W3MjaI"; // Replace with your Airtable base ID
const airtableTableName = "F8Qwbr5NYFTJU8"; // Replace with your table name
const airtableAttachmentField = "photo"; // Replace with the attachment field name
const airtableProjectField = "recpOKWgAKtNWqbsk"; // Replace with the project name field name

// Fetch projects from Airtable and populate the select dropdown
async function fetchProjects() {
  try {
    const response = await fetch(`https://api.airtable.com/v0/${airtableBaseId}/${airtableTableName}`, {
      headers: { Authorization: `Bearer ${airtableApiKey}` }
    });
    const data = await response.json();

    if (data.records) {
      projectSelect.innerHTML = data.records
        .map(record => `<option value="${record.id}">${record.fields[airtableProjectField]}</option>`)
        .join("");
    }
  } catch (error) {
    console.error("Error fetching projects: ", error);
  }
}

// Access the camera
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => {
    camera.srcObject = stream;
  })
  .catch(err => {
    console.error("Error accessing the camera: ", err);
  });

// Capture photo
captureButton.addEventListener("click", () => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = camera.videoWidth;
  canvas.height = camera.videoHeight;
  context.drawImage(camera, 0, 0, canvas.width, canvas.height);

  const photoData = canvas.toDataURL("image/png");
  photos.push(photoData);

  const img = document.createElement("img");
  img.src = photoData;
  img.className = "photo";
  photoContainer.appendChild(img);
});

// Upload photo to Google Drive
async function uploadToGoogleDrive(photoBase64) {
  const metadata = {
    name: `photo_${Date.now()}.png`,
    parents: ["13FfnaGjNyhThLtxYXxCEI2okQMjn_LAL"] // Replace with your Google Drive folder ID
  };

  const formData = new FormData();
  formData.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  formData.append(
    "file",
    new Blob([photoBase64.split(",")[1]], { type: "image/png" })
  );

  try {
    const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${googleAccessToken}`
      },
      body: formData
    });

    const data = await response.json();
    return data.id; // Return file ID
  } catch (error) {
    console.error("Google Drive upload error: ", error);
    throw error;
  }
}

// Make file publicly accessible
async function makeFilePublic(fileId) {
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${googleAccessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        role: "reader",
        type: "anyone"
      })
    });

    return `https://drive.google.com/uc?id=${fileId}`; // Return public URL
  } catch (error) {
    console.error("Error making file public: ", error);
    throw error;
  }
}

// Upload photos to Airtable
uploadButton.addEventListener("click", async () => {
  const selectedProjectId = projectSelect.value;

  if (!selectedProjectId) {
    alert("Please select a project!");
    return;
  }

  const photoUrls = [];
  for (const photo of photos) {
    try {
      // Upload to Google Drive
      const fileId = await uploadToGoogleDrive(photo);
      // Get public URL
      const publicUrl = await makeFilePublic(fileId);
      // Store the public URL
      photoUrls.push({ url: publicUrl });
    } catch (error) {
      alert("Photo upload failed. Please try again!");
      return;
    }
  }

  // Upload URLs to Airtable
  const payload = {
    fields: {
      [airtableAttachmentField]: photoUrls
    }
  };

  try {
    const response = await fetch(
      `https://api.airtable.com/v0/${airtableBaseId}/${airtableTableName}/${selectedProjectId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${airtableApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    if (response.ok) {
      alert("Photos uploaded successfully!");
      photos = [];
      photoContainer.innerHTML = "";
    } else {
      console.error("Airtable upload error: ", await response.text());
    }
  } catch (error) {
    console.error("Airtable upload failed: ", error);
  }
});

// Initialize project selection dropdown
fetchProjects();
