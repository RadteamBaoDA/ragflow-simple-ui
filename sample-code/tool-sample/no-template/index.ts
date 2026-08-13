import assert from "node:assert/strict";
import { createDocxFileTool } from "./create-docx-file.js";
import { createExcelFileTool } from "./create-excel-file.js";
import { createPptxPresentationTool } from "./create-pptx-presentation.js";
import { parseCSV } from "./xlsx-utils.js";
import { runSectionAgent } from "./pptx-section-agent.js";
import type {
  AgentRuntime,
  FileToolDependencies,
  RegisteredFunction,
} from "./types.js";

export { createDocxFileTool } from "./create-docx-file.js";
export { createExcelFileTool } from "./create-excel-file.js";
export { createPptxPresentationTool } from "./create-pptx-presentation.js";
export type * from "./types.js";

/**
 * Verifies public metadata, schemas, approval denial, CSV parsing, and fallback behavior.
 * @returns Resolves when all assertions pass.
 * @throws {AssertionError} When a portable tool contract regresses.
 */
async function selfCheck(): Promise<void> {
  // Tests use the smallest host stubs needed to exercise portable contracts.
  const approveAll =
    /** Approves every request in positive-path fixtures. */
    async () => ({ approved: true, message: "approved" });
  const tools = [
    createDocxFileTool({
      requestApproval: approveAll,
    } as unknown as FileToolDependencies),
    createExcelFileTool({
      requestApproval: approveAll,
    } as unknown as FileToolDependencies),
    createPptxPresentationTool({
      requestApproval: approveAll,
    } as unknown as FileToolDependencies),
  ];
  // Ensure the model sees three distinct functions with closed schemas.
  assert.deepEqual(
    tools.map(
      /** Selects public names for deterministic export-order validation. */
      (tool) => tool.name
    ),
    ["create-docx-file", "create-excel-file", "create-pptx-presentation"]
  );
  const functions: RegisteredFunction[] = [];
  const runtime = {
    /**
     * Captures a public function registered by a tool plugin.
     * @param definition Function definition under test.
     * @returns Nothing; appends to the fixture collection.
     */
    function(definition: RegisteredFunction) {
      functions.push(definition);
    },
  } as AgentRuntime;
  tools.forEach(
    /** Registers one tool through the same plugin path used by the host. */
    (tool) => tool.plugin().setup(runtime)
  );
  assert.equal(functions.length, 3);
  assert.equal(
    functions.every(
      /** Requires useful model-facing selection guidance. */
      (fn) => fn.description.length > 40
    ),
    true
  );
  assert.equal(
    functions.every(
      /** Requires multiple examples for each model-callable function. */
      (fn) => fn.examples.length >= 2
    ),
    true
  );
  assert.equal(
    functions.every(
      /** Requires closed schemas that reject model-invented properties. */
      (fn) => fn.parameters.additionalProperties === false
    ),
    true
  );
  // Quoted commas and embedded newlines are the parser's highest-risk cases.
  assert.deepEqual(
    parseCSV('Name,Note\nAda,"one, two"\nLin,"line 1\nline 2"'),
    [
      ["Name", "Note"],
      ["Ada", "one, two"],
      ["Lin", "line 1\nline 2"],
    ]
  );
  // Simulate the child calling its private structured submission function.
  let childOptions: unknown;
  const childFunctions = new Map<string, RegisteredFunction>();
  const child = {
    functions: childFunctions,
    /**
     * Registers one private function on the child runtime fixture.
     * @param definition Child function definition.
     * @returns Nothing; adds the definition to the child map.
     */
    function(definition: RegisteredFunction) {
      childFunctions.set(definition.name, definition);
    },
  } as AgentRuntime;
  const section = await runSectionAgent({
    parent: runtime,
    dependencies: {
      requestApproval: approveAll,
      /**
       * Captures child-runtime options and returns the fixture runtime.
       * @param options Child creation options.
       * @returns The configured child fixture runtime.
       */
      createChildRuntime(options: {
        parent: AgentRuntime;
        maxToolCalls: number;
        suppressChatOutput: boolean;
      }) {
        childOptions = options;
        return child;
      },
      /**
       * Simulates a child submitting structured slides through its private tool.
       * @returns Resolves after invoking the private submission handler.
       */
      async executeChildRuntime() {
        const submit = childFunctions.get("submit-section-slides");
        await submit?.handler.call(submit, {
          slides: [
            { layout: "content", title: "Result", content: ["Complete"] },
          ],
        });
      },
    } as unknown as FileToolDependencies,
    section: { title: "Overview", keyPoints: ["Complete"] },
    presentationTitle: "Status",
    conversationContext: "",
    sectionPrefix: "1/1",
  });
  assert.equal((childOptions as { maxToolCalls: number }).maxToolCalls, 5);
  assert.equal(childFunctions.has("submit-section-slides"), true);
  assert.equal(section.slides[0].title, "Result");
  // A provider failure must preserve citations and return deterministic slides.
  const fallback = await runSectionAgent({
    parent: runtime,
    dependencies: {
      requestApproval: approveAll,
      createChildRuntime:
        /** Returns the existing child fixture for the failure path. */
        () => child,
      executeChildRuntime:
        /** Simulates a provider failure after the child runtime exists. */
        async () => {
          throw new Error("provider failed");
        },
      getChildCitations:
        /** Returns research accumulated before the simulated failure. */
        () => ["preserved-source"],
    } as unknown as FileToolDependencies,
    section: { title: "Fallback", keyPoints: ["Still useful"] },
    presentationTitle: "Status",
    conversationContext: "",
    sectionPrefix: "1/1",
  });
  assert.deepEqual(fallback.citations, ["preserved-source"]);
  assert.equal(fallback.slides[0].layout, "section");

  // Every format must stop before persistence when approval is denied.
  for (const [factory, args] of [
    [
      createDocxFileTool,
      {
        filename: "a.docx",
        title: null,
        subtitle: null,
        author: null,
        content: "text",
        theme: "neutral",
        margins: "normal",
        includeTitlePage: false,
      },
    ],
    [
      createExcelFileTool,
      { filename: "a.xlsx", csvData: "A\n1", sheets: null, options: {} },
    ],
    [
      createPptxPresentationTool,
      {
        filename: "a.pptx",
        title: "A",
        author: "",
        theme: "default",
        sections: [{ title: "S", keyPoints: [], instructions: null }],
      },
    ],
  ] as const) {
    let saved = false;
    const deniedFunctions: RegisteredFunction[] = [];
    const tool = factory({
      requestApproval:
        /** Denies the fixture before rendering or persistence. */
        async () => ({ approved: false, message: "denied" }),
      /**
       * Detects an invalid persistence attempt after denial.
       * @returns Never resolves; throws when persistence is attempted.
       */
      async saveGeneratedFile() {
        saved = true;
        throw new Error("must not save");
      },
      /**
       * Provides the required output adapter; denial must keep it unused.
       * @returns Nothing.
       */
      registerOutput() {},
    } as FileToolDependencies);
    tool.plugin().setup({
      /**
       * Captures the denied-path function definition.
       * @param definition Function definition under test.
       * @returns Nothing; appends to the denied-path fixture collection.
       */
      function(definition) {
        deniedFunctions.push(definition);
      },
    } as AgentRuntime);
    assert.equal(
      await deniedFunctions[0].handler.call(deniedFunctions[0], args),
      "denied"
    );
    assert.equal(saved, false);
  }
}

if (process.argv.includes("--self-check")) {
  selfCheck().catch(
    /** Reports self-check failures through the command exit code. */
    (error) => {
      console.error(error);
      process.exitCode = 1;
    }
  );
}

if (process.argv.includes("--binary-self-check")) {
  binarySelfCheck().catch(
    /** Reports binary-check failures through the command exit code. */
    (error) => {
      console.error(error);
      process.exitCode = 1;
    }
  );
}

/**
 * Generates all three Office binaries and reopens their OOXML ZIP containers.
 * @returns Resolves when DOCX, XLSX, and PPTX smoke artifacts are valid.
 * @throws {AssertionError} When a binary is missing or its required OOXML entry is absent.
 */
async function binarySelfCheck(): Promise<void> {
  // Buffers stay in memory so the check never writes generated fixtures to disk.
  const buffers = new Map<string, Buffer>();
  const dependencies: FileToolDependencies = {
    /**
     * Approves all binary smoke-test requests.
     * @returns Approved fixture decision.
     */
    async requestApproval() {
      return { approved: true, message: "approved" };
    },
    /**
     * Captures the generated binary in memory for ZIP validation.
     * @param input Generated file persistence request.
     * @returns Fixture storage metadata.
     */
    async saveGeneratedFile(input) {
      buffers.set(input.fileType, input.buffer);
      return {
        filename: `stored.${input.extension}`,
        displayFilename: input.displayFilename,
        fileSize: input.buffer.length,
      };
    },
    /**
     * Satisfies the host contract without creating external state.
     * @returns Nothing.
     */
    registerOutput() {},
    /**
     * Creates an isolated child function map for one section fixture.
     * @returns Child runtime fixture with a private function map.
     */
    createChildRuntime() {
      const childFunctions = new Map<string, RegisteredFunction>();
      return {
        functions: childFunctions,
        /**
         * Registers one private function on the binary-test child runtime.
         * @param definition Child function definition.
         * @returns Nothing; adds the definition to the child map.
         */
        function(definition) {
          childFunctions.set(definition.name, definition);
        },
      };
    },
    /**
     * Simulates a successful structured slide submission from the child.
     * @param input Child execution request.
     * @returns Resolves after invoking the private submission handler.
     */
    async executeChildRuntime({ child }) {
      const submit = child.functions?.get("submit-section-slides");
      await submit?.handler.call(submit, {
        slides: [
          {
            layout: "content",
            title: "Overview",
            content: ["Complete"],
            notes: "Speaker note",
          },
        ],
      });
    },
  };
  const definitions: RegisteredFunction[] = [];
  const runtime = {
    /**
     * Captures public functions for direct handler execution.
     * @param definition Registered public function.
     * @returns Nothing; appends to the binary-test collection.
     */
    function(definition: RegisteredFunction) {
      definitions.push(definition);
    },
  } as AgentRuntime;
  [
    createDocxFileTool(dependencies),
    createExcelFileTool(dependencies),
    createPptxPresentationTool(dependencies),
  ].forEach(
    /** Registers each binary-test tool through its public plugin. */
    (tool) => tool.plugin().setup(runtime)
  );
  // Exercise public handlers rather than calling renderers directly.
  const results = [
    await definitions[0].handler.call(definitions[0], {
      filename: "smoke.docx",
      title: "Smoke",
      subtitle: null,
      author: null,
      content: "# Smoke\n\n- one\n- two",
      theme: "neutral",
      margins: "normal",
      includeTitlePage: false,
    }),
    await definitions[1].handler.call(definitions[1], {
      filename: "smoke.xlsx",
      csvData: "Name,Value\nA,1",
      sheets: null,
      options: {
        headerStyle: true,
        autoFit: true,
        freezeHeader: true,
        zebraStripes: false,
      },
    }),
    await definitions[2].handler.call(definitions[2], {
      filename: "smoke.pptx",
      title: "Smoke",
      author: "",
      theme: "default",
      sections: [
        { title: "Overview", keyPoints: ["Complete"], instructions: null },
      ],
    }),
  ];
  // Fast signature checks provide clear errors before ZIP parsing.
  for (const format of ["docx", "xlsx", "pptx"]) {
    const buffer = buffers.get(format);
    assert.ok(
      buffer && buffer.length > 1000,
      `${format} buffer missing: ${results[["docx", "xlsx", "pptx"].indexOf(format)]}`
    );
    assert.equal(buffer.subarray(0, 2).toString(), "PK");
  }
  // Required OOXML entries prove each artifact is the expected Office format.
  const zipPackage = "jszip";
  const JSZip = (await import(zipPackage)).default;
  for (const [format, requiredEntry] of [
    ["docx", "word/document.xml"],
    ["xlsx", "xl/workbook.xml"],
    ["pptx", "ppt/presentation.xml"],
  ] as const) {
    const zip = await JSZip.loadAsync(buffers.get(format));
    assert.ok(zip.file(requiredEntry), `${format} is missing ${requiredEntry}`);
  }
}
