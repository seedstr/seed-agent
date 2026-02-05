import { describe, it, expect } from "vitest";
import { calculator } from "../src/tools/calculator.js";

describe("Calculator Tool", () => {
  describe("Basic Operations", () => {
    it("should add numbers", () => {
      const result = calculator("2 + 2");
      expect(result.result).toBe(4);
    });

    it("should subtract numbers", () => {
      const result = calculator("10 - 3");
      expect(result.result).toBe(7);
    });

    it("should multiply numbers", () => {
      const result = calculator("6 * 7");
      expect(result.result).toBe(42);
    });

    it("should divide numbers", () => {
      const result = calculator("15 / 3");
      expect(result.result).toBe(5);
    });

    it("should handle decimal numbers", () => {
      const result = calculator("3.14 * 2");
      expect(result.result).toBeCloseTo(6.28);
    });

    it("should respect order of operations", () => {
      const result = calculator("2 + 3 * 4");
      expect(result.result).toBe(14);
    });

    it("should handle parentheses", () => {
      const result = calculator("(2 + 3) * 4");
      expect(result.result).toBe(20);
    });
  });

  describe("Exponentiation", () => {
    it("should handle ^ operator", () => {
      const result = calculator("2^3");
      expect(result.result).toBe(8);
    });

    it("should handle ** operator", () => {
      const result = calculator("2**3");
      expect(result.result).toBe(8);
    });
  });

  describe("Math Functions", () => {
    it("should calculate square root", () => {
      const result = calculator("sqrt(16)");
      expect(result.result).toBe(4);
    });

    it("should calculate absolute value", () => {
      const result = calculator("abs(-5)");
      expect(result.result).toBe(5);
    });

    it("should handle sin function", () => {
      const result = calculator("sin(0)");
      expect(result.result).toBe(0);
    });

    it("should handle cos function", () => {
      const result = calculator("cos(0)");
      expect(result.result).toBe(1);
    });

    it("should handle log function", () => {
      const result = calculator("log(1)");
      expect(result.result).toBe(0);
    });

    it("should handle floor function", () => {
      const result = calculator("floor(3.7)");
      expect(result.result).toBe(3);
    });

    it("should handle ceil function", () => {
      const result = calculator("ceil(3.2)");
      expect(result.result).toBe(4);
    });

    it("should handle round function", () => {
      const result = calculator("round(3.5)");
      expect(result.result).toBe(4);
    });

    it("should handle min function", () => {
      const result = calculator("min(5, 3, 8)");
      expect(result.result).toBe(3);
    });

    it("should handle max function", () => {
      const result = calculator("max(5, 3, 8)");
      expect(result.result).toBe(8);
    });

    it("should handle pow function", () => {
      const result = calculator("pow(2, 10)");
      expect(result.result).toBe(1024);
    });
  });

  describe("Constants", () => {
    it("should handle pi", () => {
      const result = calculator("pi");
      expect(result.result).toBeCloseTo(Math.PI);
    });

    it("should handle e", () => {
      const result = calculator("e");
      expect(result.result).toBeCloseTo(Math.E);
    });

    it("should use pi in calculations", () => {
      const result = calculator("2 * pi");
      expect(result.result).toBeCloseTo(2 * Math.PI);
    });
  });

  describe("Complex Expressions", () => {
    it("should handle nested functions", () => {
      const result = calculator("sqrt(pow(3, 2) + pow(4, 2))");
      expect(result.result).toBe(5);
    });

    it("should handle complex expressions", () => {
      const result = calculator("(sqrt(16) + 2) * 3 - 1");
      expect(result.result).toBe(17);
    });
  });

  describe("Result Formatting", () => {
    it("should format integers correctly", () => {
      const result = calculator("100");
      expect(result.formattedResult).toBe("100");
    });

    it("should format decimals correctly", () => {
      const result = calculator("1/3");
      expect(result.formattedResult).toContain("0.333");
    });
  });

  describe("Error Handling", () => {
    it("should throw on invalid expression", () => {
      expect(() => calculator("invalid")).toThrow();
    });

    it("should throw on potentially unsafe input", () => {
      expect(() => calculator("process.exit()")).toThrow();
    });
  });
});
