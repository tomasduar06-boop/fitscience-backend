require("dotenv").config();
const express = require("express");
const mercadopago = require("mercadopago");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("Mongo conectado"))
.catch(err=>console.log(err));

const User = mongoose.model("User", {
  email: String,
  plan: String,
  activo: Boolean
});

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN
});

app.post("/crear-pago", async (req, res) => {
  const { email, plan } = req.body;

  const precios = {
    basico: 3999,
    completo: 6999
  };

  const preference = {
    items: [{
      title: `Plan ${plan}`,
      quantity: 1,
      currency_id: "ARS",
      unit_price: precios[plan]
    }],
    metadata: { email, plan },
    back_urls: {
      success: "https://tuweb.com",
      failure: "https://tuweb.com"
    },
    notification_url: "https://TU-BACKEND.onrender.com/webhook"
  };

  const response = await mercadopago.preferences.create(preference);

  res.json({ url: response.body.init_point });
});

app.post("/webhook", async (req, res) => {
  const payment = req.body;

  if (payment.type === "payment") {
    const data = await mercadopago.payment.findById(payment.data.id);

    if (data.body.status === "approved") {
      const { email, plan } = data.body.metadata;

      await User.findOneAndUpdate(
        { email },
        { email, plan, activo: true },
        { upsert: true }
      );

      console.log("Usuario activado:", email);
    }
  }

  res.sendStatus(200);
});

app.post("/verificar", async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });

  if (user && user.activo) {
    res.json({ acceso: true });
  } else {
    res.json({ acceso: false });
  }
});

app.listen(3000, () => console.log("Servidor listo"));
