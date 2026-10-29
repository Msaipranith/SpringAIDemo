
package htinarp.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.stereotype.Controller;

@Controller
public class OllamaController {

	private static final Logger LOGGER = LoggerFactory.getLogger(OllamaController.class);

	private final ChatClient chatClient;

	public OllamaController(ChatClient.Builder builder) {
		this.chatClient = builder.build();
	}

	@GetMapping(value = "/ask", produces = "text/plain;charset=UTF-8")
	@ResponseBody
	public String ask(@RequestParam String question) {

		LOGGER.info("Received Ollama request : " + question);

		String response = chatClient.prompt().user(question).call().content();

		LOGGER.info("Ollama response generated successfully : " + response);

		return response != null ? response : "";
	}
}
