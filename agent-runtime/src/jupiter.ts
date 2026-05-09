import axios from "axios";

type JupiterPriceResponse = {
  data?: {
    SOL?: {
      price?: number;
    };
  };
};

export async function getSolUsdcPrice(): Promise<number> {
  const response = await axios.get<JupiterPriceResponse>("https://price.jup.ag/v6/price", {
    params: { ids: "SOL", vsToken: "USDC" }
  });

  const price = response.data.data?.SOL?.price;
  if (typeof price !== "number") {
    throw new Error("Jupiter price response did not include SOL/USDC price");
  }

  return price;
}
