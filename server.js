import express from "express";
import cors from "cors";

let PORT = 5000;
const app = express();

app.use(express.json());
app.use(cors());

app.post("api/signup", () => {
});


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
