const express = require("express");
const app = express();
const cors = require("cors");
var jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ox9wd7x.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    const categoriesCollection = client
      .db("pawPalaceDB")
      .collection("categories");
    const userCollection = client.db("pawPalaceDB").collection("users");
    const petCollection = client.db("pawPalaceDB").collection("pets");
    const donationCollection = client.db("pawPalaceDB").collection("donations");
    const reqOfPetCollection = client
      .db("pawPalaceDB")
      .collection("requestOfPets");

    //jwt related api

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    //middlewares
    const verifyToken = (req, res, next) => {
      // console.log("inside verify token middleware", req.headers.authorization);
      if (!req.headers.authorization) {
        // TODO: remove
        return res.status(401).send({ message: "unauthorized access49" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          // TODO: remove
          return res.status(401).send({ message: "unauthorized access54" });
        }
        req.decoded = decoded;
        next();
      });
    };
    //must use verify admin after verify token
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        // TODO: remove
        return res
          .status(403)
          .send({ message: "forbidden access verify admin" });
      }
      next();
    };

    //user related api

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      // console.log(req.headers);
      const result = await userCollection.find().toArray();
      res.send(result);
    });
    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
    );

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      //checking if the email user is exists on the database or not
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });
    //pets adoption related api
    app.get("/pets", verifyToken, async (req, res) => {
      // console.log(req.query.email);
      // console.log("token info of owner", req.user);
      // if (req.decoded.email !== req.query.email) {
      //   return res.status(403).send({ message: "forbidden access" });
      // }
      let query = {};
      if (req.query?.email) {
        query = { petOwner: req.query.email };
      }
      const result = await petCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/pets/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await petCollection.findOne(query);
      res.send(result);
    });
    app.get("/allPets", async (req, res) => {
      const filter = req.query;
      const query = {
        adopted: false,
        name: { $regex: filter.search, $options: "i" },
        category: { $regex: filter.category },
      };
      // const options = {
      //   name: { $regex: filter.search },
      // };
      const result = await petCollection
        .find(query)
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });

    app.post("/pets", verifyToken, async (req, res) => {
      const pet = req.body;
      const result = await petCollection.insertOne(pet);
      res.send(result);
    });

    app.patch("/pets/:id", async (req, res) => {
      const info = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          name: info.name,
          age: info.age,
          location: info.location,
          note: info.note,
          description: info.description,
          image: info.image,
          petOwner: info.petOwner,
          adopted: info.adopted,
          date: info.date,
          category: info.category,
        },
      };
      const result = await petCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.patch("/pet/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      // const { adopted } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          adopted: true,
        },
      };
      const result = await petCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/pets/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await petCollection.deleteOne(query);
      res.send(result);
    });
    //request pet for adoption api
    app.post("/request/pets", verifyToken, async (req, res) => {
      const pet = req.body;
      const result = await reqOfPetCollection.insertOne(pet);
      res.send(result);
    });

    app.get("/request/pets", verifyToken, async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { petOwner: req.query.email };
      }
      const result = await reqOfPetCollection.find(query).toArray();
      res.send(result);
    });
    app.delete("/request/pets/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await reqOfPetCollection.deleteOne(query);
      res.send(result);
    });
    //donation related api
    app.get("/donations", verifyToken, async (req, res) => {
      const result = await donationCollection.find().toArray();
      res.send(result);
    });
    app.get("/donations/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await donationCollection.findOne(query);
      res.send(result);
    });
    app.patch("/donations/:id", async (req, res) => {
      const info = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          shortDescription: info.shortDescription,
          description: info.description,
          maxAmount: info.maxAmount,
          expireDate: info.expireDate,
          image: info.image,
          donationOwner: info.donationOwner,
          active: info.active,
          date: info.date,
          donationName: info.donationName,
          donatedAmount: info.donatedAmount,
        },
      };
      const result = await donationCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.post("/donations", verifyToken, async (req, res) => {
      const donation = req.body;
      const result = await donationCollection.insertOne(donation);
      res.send(result);
    });

    // to show all the categories in homepage api
    app.get("/categories", async (req, res) => {
      const result = await categoriesCollection.find().toArray();
      res.send(result);
    });
    app.get("/category/:name", async (req, res) => {
      const name = req.params.name;
      const query = { category: name };
      const result = await petCollection.find(query).toArray();
      res.send(result);
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("paw palace is waiting for u");
});

app.listen(port, () => {
  console.log(`Paw Palace is running on port ${port}`);
});
