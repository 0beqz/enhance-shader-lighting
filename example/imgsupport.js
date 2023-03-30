;(function (document) {
	let checkCount = 0
	let formatFound = false

	function setHTMLClass(height, className) {
		checkCount++
		if (height == 2) {
			formatFound = true
			document.documentElement.className += " " + className
		} else {
			document.documentElement.className += " not" + className
			if (checkCount == 4 && !formatFound) {
				if (document.implementation.hasFeature("http://www.w3.org/TR/SVG11/feature#Image", "1.1")) {
					document.documentElement.className += " svg"
				} else {
					document.documentElement.className += " notsvg png"
				}
			}
		}
	}

	const JXL = new Image()
	JXL.onload = JXL.onerror = function () {
		setHTMLClass(JXL.height, "jxl")
	}
	JXL.src = "data:image/jxl;base64,/woIELASCAgQAFwASxLFgkWAHL0xqnCBCV0qDp901Te/5QM="

	const AVIF = new Image()
	AVIF.onload = AVIF.onerror = function () {
		setHTMLClass(AVIF.height, "avif")
	}
	AVIF.src =
		"data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A="

	const WebP = new Image()
	WebP.onload = WebP.onerror = function () {
		setHTMLClass(WebP.height, "webp")
	}
	WebP.src =
		"data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA"

	const JPX = new Image()
	JPX.onload = JPX.onerror = function () {
		setHTMLClass(JPX.height, "jpx")
	}
	JPX.src =
		"data:image/vnd.ms-photo;base64,SUm8AQgAAAAFAAG8AQAQAAAASgAAAIC8BAABAAAAAQAAAIG8BAABAAAAAgAAAMC8BAABAAAAWgAAAMG8BAABAAAARgAAAAAAAAAkw91vA07+S7GFPXd2jckQV01QSE9UTwAZAMFxAAAAATAAoAAKAACgAAAQgCAIAAAEb/8AAQAAAQDCPwCAAAAAAAAAAAAAAAAAjkI/AIAAAAAAAAABIAA="

	const JP2 = new Image()
	JP2.onload = JP2.onerror = function () {
		setHTMLClass(JP2.height, "jp2")
	}
	JP2.src =
		"data:image/jp2;base64,/0//UQAyAAAAAAABAAAAAgAAAAAAAAAAAAAABAAAAAQAAAAAAAAAAAAEBwEBBwEBBwEBBwEB/1IADAAAAAEAAAQEAAH/XAAEQED/ZAAlAAFDcmVhdGVkIGJ5IE9wZW5KUEVHIHZlcnNpb24gMi4wLjD/kAAKAAAAAABYAAH/UwAJAQAABAQAAf9dAAUBQED/UwAJAgAABAQAAf9dAAUCQED/UwAJAwAABAQAAf9dAAUDQED/k8+kEAGvz6QQAa/PpBABr994EAk//9k="
})((window.sandboxApi && window.sandboxApi.parentWindow && window.sandboxApi.parentWindow.document) || document)
