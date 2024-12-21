import React, { useState, useEffect } from "react";
import { db, auth } from "./firebase"; // Firebase Firestore and Authentication
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import axios from "axios"; // For Cloudinary API calls

const App = () => {
  const [image, setImage] = useState(null);
  const [name, setName] = useState("");
  const [competitors, setCompetitors] = useState([]);
  const [votes, setVotes] = useState({}); // Track votes locally
  const [sortBy, setSortBy] = useState("none"); // Sorting state

  // Sign in anonymously on app load
  useEffect(() => {
    signInAnonymously(auth)
        .then(() => console.log("Signed in anonymously"))
        .catch((error) => console.error("Error signing in:", error));

    fetchCompetitors();
  }, []);

  // Fetch competitors from Firestore
  const fetchCompetitors = async () => {
    const querySnapshot = await getDocs(collection(db, "competitors"));
    const competitorsData = [];
    querySnapshot.forEach((doc) => {
      competitorsData.push({ id: doc.id, ...doc.data() });
    });

    // Sort based on the current sorting preference
    const sortedData = sortCompetitors(competitorsData, sortBy);
    setCompetitors(sortedData);
  };

  // Handle image upload to Cloudinary and competitor addition
  const handleAddCompetitor = async () => {
    if (!name || !image) {
      alert("Please provide both a name and an image!");
      return;
    }

    try {
      console.log("Uploading image to Cloudinary...");
      const formData = new FormData();
      formData.append("file", image);
      formData.append("upload_preset", "ml_default");

      const response = await axios.post(
          "https://api.cloudinary.com/v1_1/dgqyuqa7p/image/upload", // Cloudinary API endpoint
          formData
      );
      const imageUrl = response.data.secure_url;
      console.log("Image uploaded successfully:", imageUrl);

      console.log("Adding competitor to Firestore...");
      // Add competitor to Firestore
      const docRef = await addDoc(collection(db, "competitors"), {
        name,
        imageUrl,
        flavorVotes: 0,
        looksVotes: 0,
      });
      console.log("Competitor added with ID:", docRef.id);

      // Reset form and refresh competitors
      setName("");
      setImage(null);
      fetchCompetitors();
    } catch (error) {
      console.error("Error adding competitor:", error);
    }
  };

  // Handle voting
  const handleVote = async (competitorId, category) => {
    if ((votes[competitorId]?.[category] || 0) >= 2) {
      alert("You have already used your 2 votes for this category!");
      return;
    }

    try {
      const competitorRef = doc(db, "competitors", competitorId);
      await updateDoc(competitorRef, {
        [`${category}Votes`]: votes[competitorId]?.[category] + 1 || 1,
      });

      // Update local votes to track usage
      setVotes((prevVotes) => ({
        ...prevVotes,
        [competitorId]: {
          ...prevVotes[competitorId],
          [category]: (prevVotes[competitorId]?.[category] || 0) + 1,
        },
      }));

      fetchCompetitors();
    } catch (error) {
      console.error("Error updating votes:", error);
    }
  };

  // Handle delete competitor and Cloudinary image
  const handleDelete = async (competitorId, imageUrl) => {
    try {
      console.log("Deleting competitor from Firestore...");
      const competitorRef = doc(db, "competitors", competitorId);
      await deleteDoc(competitorRef);

      // Extract public ID from Cloudinary URL
      const publicId = imageUrl.split("/").pop().split(".")[0];
      console.log("Deleting image from Cloudinary...");

      await axios.post(
          `https://api.cloudinary.com/v1_1/dgqyuqa7p/image/destroy`,
          { public_id: publicId },
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
      );

      console.log("Competitor and image deleted successfully!");
      fetchCompetitors();
    } catch (error) {
      console.error("Error deleting competitor:", error);
    }
  };

  // Sort competitors
  const sortCompetitors = (competitors, criteria) => {
    if (criteria === "flavor") {
      return [...competitors].sort((a, b) => b.flavorVotes - a.flavorVotes);
    } else if (criteria === "looks") {
      return [...competitors].sort((a, b) => b.looksVotes - a.looksVotes);
    } else if (criteria === "total") {
      return [...competitors].sort(
          (a, b) => b.flavorVotes + b.looksVotes - (a.flavorVotes + a.looksVotes)
      );
    } else {
      return competitors; // No sorting
    }
  };

  // Handle sorting
  const handleSortChange = (criteria) => {
    setSortBy(criteria);
    const sortedData = sortCompetitors(competitors, criteria);
    setCompetitors(sortedData);
  };

  return (
      <div style={{ padding: "20px" }}>
        <h1>Cookie Competition</h1>

        {/* Add Competitor */}
        <h2>Add Competitor</h2>
        <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
        />
        <input
            type="file"
            onChange={(e) => setImage(e.target.files[0])}
        />
        <button onClick={handleAddCompetitor}>Add Competitor</button>

        {/* Sorting Options */}
        <h2>Sort Competitors</h2>
        <select onChange={(e) => handleSortChange(e.target.value)} value={sortBy}>
          <option value="none">None</option>
          <option value="flavor">Flavor Votes</option>
          <option value="looks">Looks Votes</option>
          <option value="total">Total Votes</option>
        </select>

        {/* Competitors List */}
        <h2>Competitors</h2>
        {competitors.map((competitor) => (
            <div
                key={competitor.id}
                style={{
                  margin: "20px 0",
                  border: "1px solid #ccc",
                  padding: "10px",
                }}
            >
              <img
                  src={competitor.imageUrl}
                  alt={competitor.name}
                  style={{ width: "100px", height: "100px", objectFit: "cover" }}
              />
              <h3>{competitor.name}</h3>
              <p>Flavor Votes: {competitor.flavorVotes}</p>
              <p>Looks Votes: {competitor.looksVotes}</p>

              {/* Voting Buttons */}
              <button onClick={() => handleVote(competitor.id, "flavor")}>
                Vote for Flavor
              </button>
              <button onClick={() => handleVote(competitor.id, "looks")}>
                Vote for Looks
              </button>

              {/* Delete Button */}
              <button
                  onClick={() =>
                      window.confirm(
                          `Are you sure you want to delete ${competitor.name}?`
                      ) && handleDelete(competitor.id, competitor.imageUrl)
                  }
                  style={{ color: "red", marginLeft: "10px" }}
              >
                Delete Competitor
              </button>
            </div>
        ))}
      </div>
  );
};

export default App;
